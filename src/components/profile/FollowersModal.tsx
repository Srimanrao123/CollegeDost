import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FollowProfile } from "@/hooks/useFollows";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { deriveProfileDisplayName, deriveProfileInitial } from "@/lib/profileDisplay";

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  followers: FollowProfile[];
  title: string;
}

export function FollowersModal({ isOpen, onClose, followers, title }: FollowersModalProps) {
  const navigate = useNavigate();

  const handleProfileClick = (userId: string) => {
    onClose();
    navigate(`/profile/${userId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title} ({followers.length})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {followers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No {title.toLowerCase()} yet
            </p>
          ) : (
            followers.map((profile) => (
              <Card
                key={profile.id}
                className="p-3 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleProfileClick(profile.id)}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={profile.avatar_url} />
                    <AvatarFallback>
                    {deriveProfileInitial(profile)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{deriveProfileDisplayName(profile)}</p>
                    {profile.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {profile.bio}
                      </p>
                    )}
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>{profile.followers_count} followers</span>
                      <span>{profile.following_count} following</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
