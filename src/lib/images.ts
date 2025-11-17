const CDN_BASE = import.meta.env.NEXT_PUBLIC_CDN_BASE_URL || 
                 import.meta.env.VITE_CDN_BASE_URL || 
                 "https://cdn.mycd.us";

export type BuildImageArgs = {
  r2Key?: string | null;
  isLcp?: boolean;
  width?: number;
};

export function buildImageUrl({ r2Key, isLcp, width }: BuildImageArgs): string | null {
  if (!r2Key) return null;
  
  // For avatars, use provided width or default to 100
  // For posts, use isLcp to determine width (800 for LCP, 600 otherwise)
  const w = width ?? (isLcp ? 800 : 100);
  
  // Cloudflare Image Resizing with format=auto
  const params = `?width=${w}&format=auto`;
  
  return `${CDN_BASE}/${r2Key}${params}`;
}
