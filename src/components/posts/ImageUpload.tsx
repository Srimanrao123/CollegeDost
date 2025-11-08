import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface ImageUploadProps {
  preview: string;
  onImageChange: (file: File | null) => void;
}

export function ImageUpload({ preview, onImageChange }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageChange(file);
    }
  };

  const handleRemove = () => {
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {!preview ? (
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, GIF up to 10MB
          </p>
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-auto max-h-96 object-contain bg-secondary"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
