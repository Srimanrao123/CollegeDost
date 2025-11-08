import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { deriveProfileHandle, deriveProfileInitial } from '@/lib/profileDisplay';

const inputStyles = "mt-1 w-full rounded-xl border-2 border-border/60 bg-background/95 px-4 py-2 text-sm shadow-sm transition-all focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";
const textareaStyles = "mt-1 w-full rounded-xl border-2 border-border/60 bg-background/95 px-4 py-3 text-sm shadow-sm transition-all focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-none min-h-[120px]";
const sectionStyles = "space-y-4 rounded-2xl border border-border/50 bg-muted/10 p-6 shadow-sm backdrop-blur-sm";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const normalizeHandle = (value: string) =>
  value
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const EditProfileModal = ({ open, onOpenChange }: EditProfileModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profileRecord, setProfileRecord] = useState<any>(null);
  const [handlePreview, setHandlePreview] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarKey, setAvatarKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarInitial = deriveProfileInitial({
    full_name: profileRecord?.full_name ?? null,
    username: handlePreview,
  });

  useEffect(() => {
    if (user && open) {
      const loadProfile = async () => {
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          setProfileRecord(profile);
          setHandlePreview(normalizeHandle(deriveProfileHandle(profile, 'user')));
          setBio(profile.bio || '');
          setAvatarUrl(profile.avatar_url || '');
          setAvatarPreview(profile.avatar_url || '');
          setState(profile.state || '');
        }
      };
      loadProfile();
    }
  }, [user, open]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Delete old avatar if exists
      if (avatarUrl && avatarUrl.includes('profile-image')) {
        try {
          const oldFileName = avatarUrl.split('/').pop()?.split('?')[0];
          if (oldFileName) {
            await supabase.storage
              .from('profile-image')
              .remove([oldFileName]);
          }
        } catch (error) {
          // Ignore errors when deleting old image
          console.log('Could not delete old image:', error);
        }
      }

      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('profile-image')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true, // Allow overwrite if file exists
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      // Get public URL - wait a moment for file to be indexed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: urlData } = supabase.storage
        .from('profile-image')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      
      // Add cache busting query parameter for preview only
      const previewUrl = `${publicUrl}?t=${Date.now()}`;
      
      // Save URL without cache busting to database (we'll add it when displaying)
      setAvatarUrl(publicUrl);
      setAvatarPreview(previewUrl);
      setAvatarKey(prev => prev + 1); // Force re-render of avatar image

      toast({
        title: 'Image uploaded',
        description: 'Profile picture uploaded successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const normalizedHandle = normalizeHandle(handlePreview);
    if (!normalizedHandle) {
      toast({
        title: 'Invalid handle',
        description: 'Please enter a handle using letters and numbers.',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    try {
      // Build update object with only non-empty values
      const updateData: any = {};
      updateData.username = normalizedHandle;
      if (bio !== undefined) updateData.bio = bio;
      if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
      if (state !== undefined) updateData.state = state;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Profile update error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        if (error.code === '23505') {
          throw new Error('This handle is already taken. Please choose another one.');
        }
        throw error;
      }

      if (!data) {
        throw new Error('Profile update returned no data');
      }

      setHandlePreview(normalizedHandle);
      setProfileRecord(data);

      toast({ 
        title: 'Profile updated successfully!',
        description: 'Your profile information has been updated.'
      });
      
      // Dispatch event to refresh UI components with the returned data
      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { profile: data } 
      }));
      
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border border-border/60 bg-background/95 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile information and avatar
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-6">
          <div className={sectionStyles}>
            {/* Profile Picture Upload */}
            <div className="flex flex-col items-center gap-4">
              <Label>Profile Picture</Label>
              <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-primary">
                  <AvatarImage 
                    src={avatarPreview || avatarUrl || ''} 
                    key={avatarKey}
                  />
                  <AvatarFallback className="text-2xl">
                    {avatarInitial}
                  </AvatarFallback>
                </Avatar>
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAvatarUrl('');
                      setAvatarPreview('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
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
                <Label htmlFor="avatarUrl">Or enter image URL</Label>
                <Input
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value);
                    setAvatarPreview(e.target.value);
                  }}
                  placeholder="Enter image URL"
                  className={inputStyles}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="profile-handle">Profile Handle</Label>
              <Input
                id="profile-handle"
                value={handlePreview}
                onChange={(e) => setHandlePreview(normalizeHandle(e.target.value))}
                placeholder="username"
                className={inputStyles}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your public handle appears as @username. Use letters and numbers; spaces turn into hyphens.
              </p>
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself"
                rows={4}
                className={textareaStyles}
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Enter your state"
                className={inputStyles}
              />
            </div>
          </div>

          <Button onClick={handleSave} className="w-full" disabled={loading}>
            {loading ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
