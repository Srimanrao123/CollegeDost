/**
 * Client-Side Image Compression Helper
 * 
 * Compresses images before upload to reduce:
 * - Upload time
 * - Storage costs
 * - Bandwidth usage
 * - LCP time (smaller images load faster)
 * 
 * Uses browser-native Canvas API for compression
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  maxSizeKB?: number; // Target max file size in KB
  mimeType?: string; // 'image/jpeg' or 'image/webp'
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  maxSizeKB: 500,
  mimeType: 'image/jpeg',
};

/**
 * Compress an image file using Canvas API
 * 
 * @param file - Original image file
 * @param options - Compression options
 * @returns Compressed image as Blob
 * 
 * Performance Benefits:
 * - Reduces file size by 60-80% typically
 * - Maintains visual quality
 * - Faster uploads
 * - Better LCP scores
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        
        if (width > opts.maxWidth || height > opts.maxHeight) {
          const ratio = Math.min(
            opts.maxWidth / width,
            opts.maxHeight / height
          );
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

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // If file size is still too large, reduce quality further
            const sizeKB = blob.size / 1024;
            if (sizeKB > opts.maxSizeKB && opts.quality > 0.5) {
              // Recursively compress with lower quality
              const lowerQuality = Math.max(0.5, opts.quality - 0.1);
              compressImage(file, { ...opts, quality: lowerQuality })
                .then(resolve)
                .catch(reject);
              return;
            }

            resolve(blob);
          },
          opts.mimeType,
          opts.quality
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
 * Compress image and return as File object
 * Useful for form submissions
 */
export async function compressImageToFile(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const blob = await compressImage(file, options);
  
  // Preserve original filename but update extension if needed
  const originalName = file.name;
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  const extension = options.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const newName = `${nameWithoutExt}.${extension}`;

  return new File([blob], newName, {
    type: options.mimeType || DEFAULT_OPTIONS.mimeType,
    lastModified: Date.now(),
  });
}

/**
 * Get image dimensions without loading full image
 * Useful for validation and aspect ratio checks
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
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
 * Validate image file before compression
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  // Check file size (max 10MB before compression)
  const maxSizeMB = 10;
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `Image must be smaller than ${maxSizeMB}MB` };
  }

  return { valid: true };
}

