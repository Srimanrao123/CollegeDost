/**
 * Cloudflare R2 Upload Helper
 * 
 * Uploads images to R2 using S3-compatible API with direct fetch
 * This approach works better in browsers than AWS SDK
 */

export interface R2UploadOptions {
  file: File;
  userId: string;
  postId: string; // Required: post ID for the path format post-upload/<post_id>/<filename>.webp
  folder?: string; // Default: 'post-upload'
}

export interface R2UploadResult {
  key: string; // R2 key to store in database (e.g., "post-upload/user123/image.webp")
  url?: string; // Optional: Full R2 URL (if needed)
}

/**
 * Generate AWS Signature Version 4 for S3-compatible API
 * This is needed for direct R2 uploads
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

  // Create canonical request
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

  // Create string to sign
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

  // Calculate signature
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

/**
 * HMAC-SHA256 helper
 */
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
 * Convert image to WebP format using Canvas API
 */
async function convertToWebP(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate dimensions maintaining aspect ratio (max 1920px)
        let { width, height } = img;
        const maxDimension = 1920;
        
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Use high-quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to convert image to WebP'));
              return;
            }

            // Create File object with .webp extension
            const originalName = file.name.replace(/\.[^/.]+$/, '');
            const webpFile = new File([blob], `${originalName}.webp`, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            
            resolve(webpFile);
          },
          'image/webp',
          0.85 // Quality: 0.85 (85%)
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Upload image directly to R2 using S3-compatible API
 * 
 * Images are automatically converted to WebP format before upload.
 * Upload path format: post-upload/<post_id>/<filename>.webp
 * 
 * @param options - Upload options
 * @returns R2 key for database storage
 * 
 * @example
 * const result = await uploadImageToR2({
 *   file: imageFile,
 *   userId: user.id,
 *   postId: 'post-123'
 * });
 * // result.key = "post-upload/post-123/image.webp"
 */
export async function uploadImageToR2(
  options: R2UploadOptions
): Promise<R2UploadResult> {
  const { file, userId, postId, folder = 'post-upload' } = options;

  if (!postId) {
    throw new Error('postId is required for R2 upload');
  }

  console.log('📤 uploadImageToR2 called with:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    userId,
    postId,
    folder,
  });

  // Convert image to WebP format
  let webpFile: File;
  try {
    console.log('🔄 Converting image to WebP...');
    webpFile = await convertToWebP(file);
    console.log('✅ Image converted to WebP:', {
      originalSize: file.size,
      webpSize: webpFile.size,
      reduction: `${Math.round((1 - webpFile.size / file.size) * 100)}%`,
    });
  } catch (error: any) {
    console.error('❌ Failed to convert to WebP, using original file:', error);
    // Fallback: use original file if WebP conversion fails
    webpFile = file;
  }

  // Get R2 configuration
  const accountId = import.meta.env.VITE_R2_ACCOUNT_ID || import.meta.env.R2_ACCOUNT_ID;
  const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID || import.meta.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY || import.meta.env.R2_SECRET_ACCESS_KEY;
  const bucketName = import.meta.env.VITE_R2_BUCKET_NAME || import.meta.env.R2_BUCKET_NAME || 'post-upload';
  
  console.log('🔑 Checking R2 credentials...', {
    hasAccountId: !!accountId,
    hasAccessKeyId: !!accessKeyId,
    hasSecretAccessKey: !!secretAccessKey,
  });
  
  if (!accountId || !accessKeyId || !secretAccessKey) {
    const missing = [];
    if (!accountId) missing.push('VITE_R2_ACCOUNT_ID');
    if (!accessKeyId) missing.push('VITE_R2_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('VITE_R2_SECRET_ACCESS_KEY');
    throw new Error(`R2 credentials not configured. Missing: ${missing.join(', ')}`);
  }

  const endpoint = import.meta.env.VITE_CLOUDFARE_API || import.meta.env.CLOUDFARE_API || 
    `https://${accountId}.r2.cloudflarestorage.com`;

  console.log('🪣 Using bucket:', bucketName);
  console.log('🔗 Using endpoint:', endpoint);

  // Generate R2 key: post-upload/<post_id>/<filename>.webp
  const originalName = file.name.replace(/\.[^/.]+$/, '');
  const sanitizedName = originalName.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 50);
  const timestamp = Date.now();
  const filename = sanitizedName || 'image';
  const key = `${folder}/${postId}/${filename}-${timestamp}.webp`;

  try {
    // Prepare headers
    const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const contentType = 'image/webp'; // Always WebP format

    console.log('🚀 Starting R2 upload...', {
      bucketName,
      key,
      fileName: webpFile.name,
      fileSize: webpFile.size,
      contentType,
    });

    // Read WebP file as array buffer
    const fileBuffer = await webpFile.arrayBuffer();
    const fileData = new Uint8Array(fileBuffer);

    // Calculate payload hash
    const payloadHash = await crypto.subtle.digest('SHA-256', fileData);
    const payloadHashHex = Array.from(new Uint8Array(payloadHash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const urlObj = new URL(endpoint);
    const host = urlObj.host;

    // Build upload URL - R2 uses path-style URLs
    const uploadUrl = `${endpoint}/${bucketName}/${key}`;

    const headers: Record<string, string> = {
      'host': host,
      'content-type': contentType,
      'x-amz-date': datetime,
      'x-amz-content-sha256': payloadHashHex,
    };

    // Generate signature
    console.log('🔐 Generating AWS Signature V4...');
    const authorization = await generateSignatureV4(
      'PUT',
      uploadUrl,
      headers,
      payloadHashHex,
      accessKeyId,
      secretAccessKey
    );

    // Upload to R2 using fetch
    console.log('📡 Sending upload request to R2...', {
      url: uploadUrl,
      method: 'PUT',
      contentType,
    });

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'x-amz-date': datetime,
        'x-amz-content-sha256': payloadHashHex,
        'Authorization': authorization,
      },
      body: fileData,
    });

    console.log('📥 Received response from R2:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ R2 upload failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });
      throw new Error(`R2 upload failed: ${response.status} ${response.statusText}. ${errorText}`);
    }
    
    console.log('✅ Successfully uploaded to R2:', {
      key,
      bucket: bucketName,
      status: response.status,
    });

    // Get public domain for URL construction
    let publicDomain = import.meta.env.VITE_R2_PUBLIC_DOMAIN || import.meta.env.R2_PUBLIC_DOMAIN;
    // Remove protocol if present
    if (publicDomain) {
      publicDomain = publicDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
    
    // Log for debugging
    if (!publicDomain) {
      console.warn('⚠️ VITE_R2_PUBLIC_DOMAIN not set. Cannot construct public URL for uploaded image.');
    } else {
      console.log('🌐 Using R2 public domain:', publicDomain);
    }
    
    const url = publicDomain ? `https://${publicDomain}/${key}` : undefined;

    console.log('📦 R2 upload result:', { key, url, bucketName });

    return {
      key,
      url,
    };
  } catch (error: any) {
    console.error('❌ R2 upload error:', {
      error: error.message,
      code: error.Code,
      name: error.name,
      bucketName,
      key,
    });
    throw new Error(`R2 upload failed: ${error.message || 'Unknown error'}. Bucket: ${bucketName}, Key: ${key}`);
  }
}

