// @ts-nocheck
/// <reference types="https://deno.land/std@0.177.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// AWS Signature V4 for S3-compatible API (R2)
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
    .join("");

  const signedHeaders = Object.keys(headers)
    .sort()
    .map((key) => key.toLowerCase())
    .join(";");

  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const datetime = headers["x-amz-date"] || new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const region = "auto";
  const service = "s3";

  const credentialScope = `${date}/${region}/${service}/aws4_request`;

  const canonicalRequestHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const stringToSign = [
    algorithm,
    datetime,
    credentialScope,
    canonicalRequestHashHex,
  ].join("\n");

  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
}

async function hmacSha256(key: string, message: string): Promise<Uint8Array> {
  const keyData = new TextEncoder().encode(key);
  const messageData = new TextEncoder().encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData.buffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return new Uint8Array(signature);
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405,
        }
      );
    }

    // Get auth token from header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Initialize Supabase client to verify auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = user.id;

    // Parse multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: "No file provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate file type
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid file type. Only JPEG, PNG, and WebP are allowed.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate file size (max 3MB)
    const maxSize = 3 * 1024 * 1024; // 3MB
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "File too large. Maximum size is 3MB.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get R2 configuration from environment
    const r2AccountId = Deno.env.get("R2_ACCOUNT_ID");
    const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const r2BucketName = Deno.env.get("R2_BUCKET_NAME") || "post-upload";

    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
      console.error("Missing R2 credentials", {
        hasAccountId: !!r2AccountId,
        hasAccessKeyId: !!r2AccessKeyId,
        hasSecretAccessKey: !!r2SecretAccessKey,
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Server configuration error: Missing R2 credentials. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY secrets.",
          details: {
            missing: {
              accountId: !r2AccountId,
              accessKeyId: !r2AccessKeyId,
              secretAccessKey: !r2SecretAccessKey,
            }
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate R2 key: avatars/<user_id>/avatar.<ext>
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const r2Key = `avatars/${userId}/avatar.${fileExt}`;

    // Read file as array buffer
    const fileBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(fileBuffer);

    // Calculate payload hash
    const payloadHash = await crypto.subtle.digest("SHA-256", fileData);
    const payloadHashHex = Array.from(new Uint8Array(payloadHash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Prepare headers for R2 upload
    const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const contentType = file.type;
    const endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;
    const uploadUrl = `${endpoint}/${r2BucketName}/${r2Key}`;
    const urlObj = new URL(endpoint);
    const host = urlObj.host;

    const headers: Record<string, string> = {
      host: host,
      "content-type": contentType,
      "x-amz-date": datetime,
      "x-amz-content-sha256": payloadHashHex,
    };

    // Generate AWS Signature V4
    const authorization = await generateSignatureV4(
      "PUT",
      uploadUrl,
      headers,
      payloadHashHex,
      r2AccessKeyId,
      r2SecretAccessKey
    );

    // Upload to R2
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-amz-date": datetime,
        "x-amz-content-sha256": payloadHashHex,
        Authorization: authorization,
      },
      body: fileData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("R2 upload failed:", {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        errorText,
        uploadUrl,
        r2Key,
        bucketName: r2BucketName,
        accountId: r2AccountId,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to upload avatar to storage: ${uploadResponse.status} ${uploadResponse.statusText}. ${errorText || 'Unknown error'}`,
          details: {
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            errorText: errorText.substring(0, 200), // Limit error text length
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update profile with avatar_r2_key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: profileData, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        avatar_r2_key: r2Key,
        avatar_r2_migrated: true,
      })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to update profile",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        avatar_r2_key: r2Key,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

