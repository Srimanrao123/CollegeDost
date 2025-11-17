import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProfileService } from "@/services/profileService";

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface FollowProfile {
  id: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  followers_count: number;
  following_count: number;
}

async function getFollowersCount(userId: string) {
  // Optimized: Use index on following_id for count query
  // Using 'planned' count is faster than 'exact' for large tables
  // The profiles.followers_count column is kept in sync via triggers
  const { count } = await supabase
    .from("follows")
    .select("id", { count: "planned", head: true })
    .eq("following_id", userId);
  return count ?? 0;
}

async function getFollowingCount(userId: string) {
  // Optimized: Use index on follower_id for count query
  // Using 'planned' count is faster than 'exact' for large tables
  // The profiles.following_count column is kept in sync via triggers
  const { count } = await supabase
    .from("follows")
    .select("id", { count: "planned", head: true })
    .eq("follower_id", userId);
  return count ?? 0;
}

async function updateProfileCounts(followerId: string, followingId: string) {
  const [followersCount, followingCount] = await Promise.all([
    getFollowersCount(followingId),
    getFollowingCount(followerId),
  ]);

  await Promise.all([
    supabase
      .from("profiles")
      .update({ followers_count: followersCount })
      .eq("id", followingId),
    supabase
      .from("profiles")
      .update({ following_count: followingCount })
      .eq("id", followerId),
  ]);

  window.dispatchEvent(new Event("profileUpdated"));
}

export function useFollows(userId: string | undefined) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState<FollowProfile[]>([]);
  const [following, setFollowing] = useState<FollowProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const checkIsFollowing = async (targetUserId: string) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", userId)
        .eq("following_id", targetUserId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      setIsFollowing(!!data);
    } catch (error: any) {
      console.error("Error checking follow status:", error);
    }
  };

  const fetchFollowers = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("follows")
        .select(
          `
          follower_id,
          profiles!follows_follower_id_fkey (
            id,
            username,
            avatar_url,
            bio,
            followers_count,
            following_count
          )
        `
        )
        .eq("following_id", userId);

      if (error) throw error;
      const profiles = data?.map((f) => (f as any).profiles).filter(Boolean) || [];
      setFollowers(profiles);
    } catch (error: any) {
      console.error("Error fetching followers:", error);
    }
  };

  const fetchFollowing = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("follows")
        .select(
          `
          following_id,
          profiles!follows_following_id_fkey (
            id,
            username,
            avatar_url,
            bio,
            followers_count,
            following_count
          )
        `
        )
        .eq("follower_id", userId);

      if (error) throw error;
      const profiles = data?.map((f) => (f as any).profiles).filter(Boolean) || [];
      setFollowing(profiles);
    } catch (error: any) {
      console.error("Error fetching following:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (targetUserId: string) => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please sign in to follow users",
        variant: "destructive",
      });
      return;
    }

    if (userId === targetUserId) {
      toast({
        title: "Error",
        description: "You cannot follow yourself",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", userId)
          .eq("following_id", targetUserId);

        if (error) throw error;

        await ProfileService.decrementFollowerCounts(userId, targetUserId);
        await Promise.all([fetchFollowers(), fetchFollowing()]);
        setIsFollowing(false);

        toast({
          title: "Unfollowed",
          description: "You have unfollowed this user",
        });
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({
            follower_id: userId,
            following_id: targetUserId,
          });

        if (error) throw error;

        await ProfileService.incrementFollowerCounts(userId, targetUserId);
        await Promise.all([fetchFollowers(), fetchFollowing()]);
        setIsFollowing(true);

        toast({
          title: "Following",
          description: "You are now following this user",
        });
      }
    } catch (error: any) {
      console.error("toggleFollow error", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update follow status",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (userId) {
      fetchFollowers();
      fetchFollowing();
      ProfileService.refreshFollowerData(userId);

      const channel = supabase
        .channel(`follows-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "follows",
            filter: `follower_id=eq.${userId}`,
          },
          () => {
            fetchFollowing();
            ProfileService.refreshFollowerData(userId);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "follows",
            filter: `following_id=eq.${userId}`,
          },
          () => {
            fetchFollowers();
            ProfileService.refreshFollowerData(userId);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  return {
    isFollowing,
    followers,
    following,
    loading,
    checkIsFollowing,
    toggleFollow,
    refetch: () => {
      fetchFollowers();
      fetchFollowing();
    },
  };
}
