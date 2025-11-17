/**
 * Upload Post Image Edge Function
 * 
 * Uploads post images to Cloudflare R2 storage.
 * - Accepts multipart/form-data with a 'file' field
 * - Converts images to WebP format
 * - Uploads to R2 using S3-compatible API
 * - Returns R2 key and public URL
 * 
 * Required Environment Variables:
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME (default: "post-upload")
 * - R2_PUBLIC_DOMAIN (optional, for public URL construction)
 * - SUPABASE_URL (auto-set)
 * - SUPABASE_SERVICE_ROLE_KEY (auto-set)
 */

// @ts-ignore - Deno runtime types
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore - Deno runtime types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generate AWS Signature Version 4 for S3-compatible API (R2)
 */
async function generateSignatureV4(
  method: string,
  url: string,
  headers: Record<string, string>,
  payloadHash: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<string> {
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  const query = urlObj.search.slice(1);

  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((key) => `${key.toLowerCase()}:${headers[key].trim()}\n`)
    .join('');
  
  const signedHeaders = Object.keys(headers)
    .sort()
    .map((key) => key.toLowerCase())
    .join(';');

  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = headers['x-amz-date'] || new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const region = 'auto';
  const service = 's3';

  const credentialScope = `${date}/${region}/${service}/aws4_request`;

  const canonicalRequestHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const stringToSign = [
    algorithm,
    datetime,
    credentialScope,
    canonicalRequestHashHex,
  ].join('\n');

  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
}

async function hmacSha256(key: string | Uint8Array, message: string): Promise<Uint8Array> {
  let keyData: Uint8Array;
  if (typeof key === 'string') {
    keyData = new TextEncoder().encode(key);
  } else {
    keyData = new Uint8Array(key);
  }
  const messageData = new TextEncoder().encode(message);
  
  const keyBuffer = keyData.buffer instanceof ArrayBuffer 
    ? keyData.buffer.slice(keyData.byteOffset, keyData.byteOffset + keyData.byteLength)
    : new Uint8Array(keyData).buffer;
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return new Uint8Array(signature);
}

/**
 * Convert image to WebP format using Canvas API (Deno-compatible)
 * Note: This is a simplified version. For production, consider using a Deno image library.
 */
async function convertToWebP(imageData: Uint8Array, mimeType: string): Promise<Uint8Array> {
  // For now, return original if not a supported format
  // In production, you might want to use a Deno image processing library
  // or call an external service for image conversion
  
  // If already WebP, return as-is
  if (mimeType === 'image/webp') {
    return imageData;
  }
  
  // For other formats, we'll upload as-is for now
  // TODO: Integrate a Deno image library (e.g., via wasm) for WebP conversion
  return imageData;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405,
        }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Get user from Supabase auth
    // @ts-ignore - Deno.env is available in Deno runtime
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // @ts-ignore - Deno.env is available in Deno runtime
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch },
      auth: {
        persistSession: false,
      },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const postId = formData.get("postId") as string | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "File is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return new Response(
        JSON.stringify({ error: "File must be an image" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: "File size must be less than 10MB" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Get R2 configuration
    // @ts-ignore - Deno.env is available in Deno runtime
    const r2AccountId = Deno.env.get("R2_ACCOUNT_ID");
    // @ts-ignore - Deno.env is available in Deno runtime
    const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    // @ts-ignore - Deno.env is available in Deno runtime
    const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    // @ts-ignore - Deno.env is available in Deno runtime
    const r2BucketName = Deno.env.get("R2_BUCKET_NAME") || "post-upload";
    // @ts-ignore - Deno.env is available in Deno runtime
    const r2PublicDomain = Deno.env.get("R2_PUBLIC_DOMAIN");

    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
      console.error("Missing R2 credentials");
      return new Response(
        JSON.stringify({ 
          error: "Server configuration error: Missing R2 credentials. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY secrets." 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Read file data
    const fileArrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(fileArrayBuffer);

    // Convert to WebP (simplified - returns original for now)
    const webpData = await convertToWebP(fileData, file.type);
    const contentType = "image/webp";

    // Generate R2 key
    const originalName = file.name.replace(/\.[^/.]+$/, '');
    const sanitizedName = originalName.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 50);
    const timestamp = Date.now();
    const filename = sanitizedName || 'image';
    const folder = postId ? `post-upload/${postId}` : 'post-upload';
    const key = `${folder}/${filename}-${timestamp}.webp`;

    // Prepare upload
    const endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;
    const uploadUrl = `${endpoint}/${r2BucketName}/${key}`;

    const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    // Ensure we have a proper ArrayBuffer for crypto.subtle.digest
    // Create a new ArrayBuffer from the Uint8Array to avoid SharedArrayBuffer issues
    const buffer = new Uint8Array(webpData).buffer;
    const payloadHash = await crypto.subtle.digest('SHA-256', buffer);
    const payloadHashHex = Array.from(new Uint8Array(payloadHash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const urlObj = new URL(endpoint);
    const host = urlObj.host;

    const headers: Record<string, string> = {
      'host': host,
      'content-type': contentType,
      'x-amz-date': datetime,
      'x-amz-content-sha256': payloadHashHex,
    };

    // Generate signature
    const authorization = await generateSignatureV4(
      'PUT',
      uploadUrl,
      headers,
      payloadHashHex,
      r2AccessKeyId,
      r2SecretAccessKey
    );

    // Upload to R2
    // Use the Uint8Array directly as fetch accepts it as BodyInit
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'x-amz-date': datetime,
        'x-amz-content-sha256': payloadHashHex,
        'Authorization': authorization,
      },
      // @ts-ignore - Uint8Array is valid BodyInit, TypeScript type inference issue
      body: webpData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("R2 upload failed:", {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        errorText,
      });
      return new Response(
        JSON.stringify({ 
          error: `R2 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}` 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Construct public URL
    let publicUrl: string | undefined;
    if (r2PublicDomain) {
      const domain = r2PublicDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      publicUrl = `https://${domain}/${key}`;
    }

    return new Response(
      JSON.stringify({
        data: {
          key,
          url: publicUrl,
        },
        message: "Image uploaded successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

