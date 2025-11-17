import { Image, Video, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export const CreatePost = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  // Fetch user's avatar from profiles table
  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user) return;

      try {
        type ProfileRow = { avatar_r2_key?: string | null; avatar_url?: string | null; full_name?: string | null };
        const { data } = await supabase
          .from('profiles')
          .select('avatar_r2_key, avatar_url, full_name, username')
          .eq('id', user.id)
          .maybeSingle<ProfileRow>();

        const profileData = data as ProfileRow | null;

        if (profileData) {
          // Use getAvatarUrl helper to get avatar URL (R2 or fallback)
          const { getAvatarUrl } = await import("@/lib/profileDisplay");
          const avatarUrlValue = getAvatarUrl(profileData, 40);
          if (avatarUrlValue) {
            setAvatarUrl(avatarUrlValue);
          }
          if (profileData.full_name) {
            setProfileName(profileData.full_name);
          }
        }
      } catch (error) {
        console.error('Error fetching avatar:', error);
      }
    };

    fetchAvatar();
  }, [user]);


  const displayName = useMemo(() => {
    return (
      profileName ||
      (user?.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
      user?.email?.split("@")[0] ||
      null
    );
  }, [profileName, user?.user_metadata, user?.email]);

  const handleCreatePost = (e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to create a post",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    navigate("/create-post");
  };

  return (
    <Card
      className="p-4 mb-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCreatePost}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 border-2 border-primary/10 overflow-hidden">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="User Avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-primary">
              {displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
            </span>
          )}
        </div>
        <div
          className="flex-1 px-4 py-2 bg-secondary rounded-full text-sm text-muted-foreground hover:bg-secondary/80 transition-colors"
        >
          What's on your mind{displayName ? `, ${displayName}` : ''}?
        </div>
      </div>

      <div className="flex items-center justify-around mt-3 pt-3 border-t">
        <Button
          variant="ghost"
          className="flex-1 gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
          onClick={handleCreatePost}
        >
          <Image className="h-5 w-5" />
          <span className="text-sm font-medium">Photo</span>
        </Button>
        <Button
          variant="ghost"
          className="flex-1 gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
          onClick={handleCreatePost}
        >
          <Video className="h-5 w-5" />
          <span className="text-sm font-medium">Video</span>
        </Button>
        <Button
          variant="ghost"
          className="flex-1 gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
          onClick={handleCreatePost}
        >
          <BarChart3 className="h-5 w-5" />
          <span className="text-sm font-medium">Poll</span>
        </Button>
      </div>
    </Card>
  );
};
