import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";

interface EditBannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  initialBannerUrl?: string;
}

const inputStyles =
  "mt-1 w-full rounded-xl border-2 border-border/60 bg-background/95 px-4 py-2 text-sm shadow-sm transition-all focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

const extractStoragePath = (url?: string | null) => {
  if (!url) return null;
  const parts = url.split("/banners/");
  if (parts.length < 2) return null;
  return decodeURIComponent(parts[1].split("?")[0]);
};

export const EditBannerModal = ({
  open,
  onOpenChange,
  profileId,
  initialBannerUrl,
}: EditBannerModalProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bannerUrl, setBannerUrl] = useState<string>(initialBannerUrl ?? "");
  const [bannerPreview, setBannerPreview] = useState<string>(initialBannerUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDeletionPaths, setPendingDeletionPaths] = useState<string[]>([]);

  const queueForDeletion = (url?: string | null) => {
    const path = extractStoragePath(url);
    if (!path) return;
    setPendingDeletionPaths((paths) =>
      paths.includes(path) ? paths : [...paths, path]
    );
  };

  const removeFromDeletionQueue = (url?: string | null) => {
    const path = extractStoragePath(url);
    if (!path) return;
    setPendingDeletionPaths((paths) => paths.filter((p) => p !== path));
  };

  useEffect(() => {
    if (open) {
      setBannerUrl(initialBannerUrl ?? "");
      setBannerPreview(initialBannerUrl ?? "");
      setPendingDeletionPaths([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open, initialBannerUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 8MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const previousUrl = bannerUrl;

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${profileId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600",
          metadata: {
            profile_id: profileId,
          },
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("banners")
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error("Failed to retrieve uploaded banner URL.");
      }

      const publicUrl = urlData.publicUrl;
      setBannerUrl(publicUrl);
      setBannerPreview(`${publicUrl}?t=${Date.now()}`);

      queueForDeletion(previousUrl);

      toast({
        title: "Banner uploaded",
        description: "Your banner image is ready to save.",
      });
    } catch (error: any) {
      console.error("Banner upload failed:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Unable to upload banner image.",
        variant: "destructive",
      });
      setBannerPreview(previousUrl ?? "");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBanner = () => {
    queueForDeletion(bannerUrl);
    setBannerUrl("");
    setBannerPreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const updateData: Record<string, any> = {
        banner_url: bannerUrl || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profileId)

      if (error) {
        throw error;
      }

      if (pendingDeletionPaths.length > 0) {
        await supabase.storage.from("banners").remove(pendingDeletionPaths);
        setPendingDeletionPaths([]);
      }

      toast({
        title: "Banner updated",
        description: bannerUrl ? "Profile banner updated successfully." : "Banner removed.",
      });

      window.dispatchEvent(
        new CustomEvent("profileUpdated", {
          detail: {
            profile: {
              id: profileId,
              banner_url: updateData.banner_url,
            },
          },
        })
      );

      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to update banner:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update banner.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-border/60 bg-background/95 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Edit Profile Banner</DialogTitle>
          <DialogDescription>Upload or update your profile banner image.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/30">
            {bannerPreview ? (
              <img src={bannerPreview} alt="Banner preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                No banner selected
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload Banner"}
            </Button>
            {bannerUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveBanner}
                disabled={uploading}
              >
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div>
            <Label htmlFor="bannerUrl">Or enter image URL</Label>
            <Input
              id="bannerUrl"
              value={bannerUrl}
              onChange={(e) => {
                const value = e.target.value;
                if (value !== bannerUrl) {
                  queueForDeletion(bannerUrl);
                }
                setBannerUrl(value);
                setBannerPreview(value);
                if (value === initialBannerUrl) {
                  removeFromDeletionQueue(initialBannerUrl);
                }
              }}
              placeholder="https://example.com/banner.jpg"
              className={inputStyles}
            />
          </div>

          <Button
            onClick={handleSave}
            className="w-full"
            disabled={saving || uploading}
          >
            {saving ? "Saving..." : "Save Banner"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

