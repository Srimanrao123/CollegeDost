import { useState, useEffect, useRef, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}

export const OptimizedImage = ({ 
  src, 
  alt, 
  className,
  fallbackSrc = '/placeholder.svg',
  ...props 
}: OptimizedImageProps) => {
  const [imageSrc, setImageSrc] = useState<string | undefined>(fallbackSrc);
  const [isLoading, setIsLoading] = useState(true);
  const [inView, setInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          setImageSrc(src);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setImageSrc(fallbackSrc);
    setIsLoading(false);
  };

  return (
    <div ref={imgRef} className={cn("relative bg-muted/30 rounded-lg overflow-hidden", className)}>
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/50 to-muted animate-pulse" />
      )}
      <img
        src={imageSrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          "w-full h-auto object-contain"
        )}
        {...props}
      />
    </div>
  );
};

