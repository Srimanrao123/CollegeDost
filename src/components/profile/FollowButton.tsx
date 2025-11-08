import { useEffect } from "react";
import { useFollows } from "@/hooks/useFollows";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus } from "lucide-react";

interface FollowButtonProps {
  userId: string;
}

export function FollowButton({ userId }: FollowButtonProps) {
  const { user } = useAuth();
  const { isFollowing, checkIsFollowing, toggleFollow } = useFollows(user?.id);

  useEffect(() => {
    if (user?.id) {
      checkIsFollowing(userId);
    }
  }, [userId, user?.id]);

  if (!user || user.id === userId) {
    return null;
  }

  return (
    <Button
      onClick={() => toggleFollow(userId)}
      variant={isFollowing ? "outline" : "default"}
      size="sm"
    >
      {isFollowing ? (
        <>
          <UserMinus className="h-4 w-4 mr-2" />
          Unfollow
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4 mr-2" />
          Follow
        </>
      )}
    </Button>
  );
}
