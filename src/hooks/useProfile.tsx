import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProfileService } from "@/services/profileService";
import { createRealtimeChannel } from "@/lib/realtime";

interface Profile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  banner_url?: string | null;
  bio?: string;
  state?: string;
  entrance_exam?: string[];
  interested_exams?: string[];
  likes?: number;
  followers_count: number;
  following_count: number;
}

// Optimized fetch function for profile data
const fetchProfile = async (profileId: string): Promise<Profile | null> => {
  if (!profileId) return null;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (error) throw error;
    return data as Profile;
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
};

/**
 * Optimized hook for fetching and managing profile data with React Query
 * Includes real-time updates and automatic cache invalidation
 */
export function useProfile(profileId: string | null | undefined) {
  const queryClient = useQueryClient();
  
  // Create query key
  const queryKey = ['profile', profileId];

  // Use React Query for profile data
  const query = useQuery({
    queryKey,
    queryFn: () => fetchProfile(profileId!),
    enabled: !!profileId, // Only run query if profileId exists
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes cache
    retry: 1,
  });

  // Real-time subscription for profile updates
  useEffect(() => {
    if (!profileId || typeof window === "undefined") return;

    const rt = createRealtimeChannel(`realtime:profile:${profileId}`);

    rt.onPostgresChange(
      { table: "profiles", event: "UPDATE", filter: `id=eq.${profileId}` },
      async (payload) => {
        const updatedData = payload.new as any;
        
        // Optimistically update the cache
        queryClient.setQueryData(queryKey, (oldData: Profile | null | undefined) => {
          if (!oldData) return updatedData as Profile;
          return { ...oldData, ...updatedData } as Profile;
        });

        // Also dispatch the custom event for backward compatibility
        window.dispatchEvent(new Event('profileUpdated'));
      }
    );

    rt.subscribe().catch((err: any) => {
      console.error("Failed to subscribe to profile realtime:", err);
    });

    return () => {
      rt.unsubscribe();
    };
  }, [profileId, queryClient, queryKey]);

  // Listen for manual profile update events
  useEffect(() => {
    const handleProfileUpdate = () => {
      if (profileId) {
        queryClient.invalidateQueries({ queryKey });
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, [profileId, queryClient, queryKey]);

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

