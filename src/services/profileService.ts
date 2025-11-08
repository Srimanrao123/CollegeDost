import { supabase } from '@/integrations/supabase/client';

async function getFollowersCount(userId: string) {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);
  return count ?? 0;
}

async function getFollowingCount(userId: string) {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);
  return count ?? 0;
}

export interface OnboardingData {
  state: string;
  entrance_exam: string[];
  interested_exams: string[];
  onboarding_completed?: boolean;
}

export interface ProfileCreateData {
  username?: string;
  full_name?: string;
  email?: string;
  phone_no?: string;
  state?: string;
  entrance_exam?: string[];
  interested_exams?: string[];
  avatar_url?: string | null;
}

/**
 * Profile Service - Centralized profile management
 * Handles both Supabase auth users and phone auth users
 */
export class ProfileService {
  /**
   * Generate a unique username from full name
   */
  static generateUsername(fullName: string): string {
    const base = fullName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const random = Math.floor(Math.random() * 1000);
    return `${base}${random}`;
  }

  /**
   * Generate a unique username and check for uniqueness
   */
  static async generateUniqueUsername(fullName: string, maxAttempts: number = 5): Promise<string> {
    let attempts = 0;
    let username = this.generateUsername(fullName);
    
    while (attempts < maxAttempts) {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      
      if (!data) {
        return username; // Username is available
      }
      
      // Generate a new username with different random number
      username = this.generateUsername(fullName);
      attempts++;
    }
    
    // If all attempts failed, append timestamp
    return `${this.generateUsername(fullName)}${Date.now().toString().slice(-4)}`;
  }
  /**
   * Get user ID from Supabase Auth
   */
  static async getUserId(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  }

  /**
   * Get user ID synchronously (from current session)
   * Note: Supabase v2 doesn't support synchronous session access
   * Use getUserId() instead for async access
   */
  static getUserIdSync(): string | null {
    // Supabase v2 doesn't provide synchronous session access
    // This method is kept for backward compatibility but always returns null
    // Use getUserId() for async access instead
    return null;
  }

  /**
   * Get phone number from Supabase Auth user
   */
  static async getPhoneNumber(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.phone || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if profile exists by phone number
   */
  static async getProfileByPhone(phone: string) {
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('phone_no', phone)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * @deprecated Use upsertProfile instead - users are now created in Supabase Auth
   */
  static async createPhoneAuthProfile(phone: string, username: string): Promise<string> {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bvikkwalgbcembzxnpau.supabase.co";
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ phone, username }),
    });

    let data;
    try {
      const responseText = await response.text();
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error("Failed to parse response:", parseError);
      throw new Error("Invalid response from server");
    }

    if (!response.ok || !data.success) {
      const errorMessage = data.error || data.message || `Server error (${response.status})`;
      throw new Error(errorMessage);
    }

    const userId = data.userId || data.profileId;
    if (!userId) {
      throw new Error("Failed to get user ID from server");
    }

    return userId;
  }

  /**
   * Fetch profile by user ID
   */
  static async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }


  /**
   * Create or update profile (upsert)
   */
  static async upsertProfile(
    userId: string,
    profileData: Partial<ProfileCreateData & OnboardingData>
  ) {
    // Check if profile exists
    const existing = await this.getProfile(userId);

    if (existing) {
      // Update existing profile - ensure array fields are properly formatted
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      let generatedUsername: string | null = null;

      // Only include defined fields in update
      if (profileData.username !== undefined) {
        updateData.username = profileData.username;
      }

      if (profileData.full_name !== undefined) {
        const trimmedFullName = profileData.full_name?.trim() || "";
        updateData.full_name = trimmedFullName || null;

        const hasExplicitUsername = profileData.username !== undefined && profileData.username !== null;
        const shouldGenerateUsername =
          !!trimmedFullName &&
          !hasExplicitUsername &&
          (!existing.username ||
            !existing.full_name ||
            existing.username.startsWith("user_") ||
            existing.full_name.trim().toLowerCase() !== trimmedFullName.toLowerCase());

        if (shouldGenerateUsername) {
          generatedUsername = await this.generateUniqueUsername(trimmedFullName);
        }
      }
      if (profileData.email !== undefined) updateData.email = profileData.email || null;
      if (profileData.phone_no !== undefined) updateData.phone_no = profileData.phone_no;
      if (profileData.state !== undefined) {
        updateData.state = profileData.state || null;
      }
      if (profileData.avatar_url !== undefined) updateData.avatar_url = profileData.avatar_url;
      if (profileData.onboarding_completed !== undefined) {
        updateData.onboarding_completed = profileData.onboarding_completed;
      }
      
      // Always set array fields if they exist in profileData (use 'in' operator to check property existence)
      // This ensures we can clear arrays or set them properly, even if they're empty arrays
      if ('entrance_exam' in profileData) {
        updateData.entrance_exam = Array.isArray(profileData.entrance_exam) 
          ? profileData.entrance_exam 
          : [];
      }
      if ('interested_exams' in profileData) {
        updateData.interested_exams = Array.isArray(profileData.interested_exams) 
          ? profileData.interested_exams 
          : [];
      }

      if (!updateData.username && generatedUsername) {
        updateData.username = generatedUsername;
      }

      console.log('Updating profile with data:', JSON.stringify(updateData, null, 2));
      console.log('Profile data received:', JSON.stringify(profileData, null, 2));
      console.log('User ID:', userId);

      // Verify updateData has the fields we expect
      if (updateData.state === undefined && 'state' in profileData) {
        console.warn('WARNING: state is missing from updateData but exists in profileData');
      }
      if (!('entrance_exam' in updateData) && 'entrance_exam' in profileData) {
        console.warn('WARNING: entrance_exam is missing from updateData but exists in profileData');
      }
      if (!('interested_exams' in updateData) && 'interested_exams' in profileData) {
        console.warn('WARNING: interested_exams is missing from updateData but exists in profileData');
      }

      // Update without select first to avoid JSON coercion issues
      const { data: updateResult, error: updateError, count } = await (supabase as any)
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select('id'); // Select only id to check if update worked

      if (updateError) {
        console.error('Profile update error:', updateError);
        console.error('Update error details:', JSON.stringify(updateError, null, 2));
        throw updateError;
      }

      console.log('Update result:', updateResult);
      console.log('Rows affected:', updateResult?.length || 0);

      if (!updateResult || updateResult.length === 0) {
        console.error('WARNING: Update query returned no rows. Profile might not exist or RLS is blocking update.');
        throw new Error('Update did not affect any rows. Please check if profile exists and RLS policies allow update.');
      }

      // Fetch the updated profile separately to avoid JSON coercion issues with arrays
      const { data, error: fetchError } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Profile fetch error after update:', fetchError);
        throw fetchError;
      }

      console.log('Profile updated successfully:', JSON.stringify(data, null, 2));
      return data;
    } else {
      // Create new profile - generate username if not provided but full_name is
      let username = profileData.username;
      if (!username && profileData.full_name) {
        username = await this.generateUniqueUsername(profileData.full_name);
      } else if (!username) {
        // Fallback: generate from user ID if no full_name
        username = `user_${userId.slice(0, 8)}`;
      }

      // Create new profile
      const { data, error } = await (supabase as any)
        .from('profiles')
        .insert({
          id: userId,
          username: username,
          full_name: profileData.full_name || null,
          email: profileData.email || null,
          phone_no: profileData.phone_no,
          state: profileData.state,
          entrance_exam: profileData.entrance_exam || [],
          interested_exams: profileData.interested_exams || [],
          avatar_url: profileData.avatar_url || null,
          followers_count: 0,
          following_count: 0,
          onboarding_completed: profileData.onboarding_completed ?? false,
        })
        .select()
        .single();

      if (error) {
        // If duplicate key error, try update instead
        if (error.code === '23505') {
          return this.upsertProfile(userId, profileData);
        }
        throw error;
      }
      return data;
    }
  }

  /**
   * Update onboarding data
   * Uses edge function to bypass RLS for phone auth users
   */
  static async updateOnboarding(userId: string, onboardingData: OnboardingData) {
    // Ensure arrays are properly formatted
    const entranceExams = Array.isArray(onboardingData.entrance_exam) 
      ? onboardingData.entrance_exam 
      : [];
    const interestedExams = Array.isArray(onboardingData.interested_exams) 
      ? onboardingData.interested_exams 
      : [];

    const profileData = {
      state: onboardingData.state,
      entrance_exam: entranceExams,
      interested_exams: interestedExams,
      onboarding_completed: onboardingData.onboarding_completed !== undefined 
        ? onboardingData.onboarding_completed 
        : true,
    };

    console.log('updateOnboarding - Updating profile via edge function:', {
      userId,
      profileData: JSON.stringify(profileData, null, 2),
      entranceExamsLength: entranceExams.length,
      interestedExamsLength: interestedExams.length,
    });

    // Check if user has Supabase auth session (for RLS)
    let hasAuthSession = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      hasAuthSession = !!user && user.id === userId;
    } catch {
      hasAuthSession = false;
    }

    // If user has auth session, use direct update (faster)
    // Otherwise, use edge function to bypass RLS
    if (hasAuthSession) {
      console.log('User has auth session, using direct update');
      const updateData = {
        ...profileData,
        updated_at: new Date().toISOString(),
      };

      // Try direct update with select to verify it worked
      const { data: updateResult, error: updateError } = await (supabase as any)
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select('id, state, entrance_exam, interested_exams, onboarding_completed')
        .single();

      if (updateError) {
        console.error('❌ Direct update failed, trying edge function:', updateError);
        // Fall through to edge function
      } else if (updateResult) {
        // Verify the update worked
        if (updateResult.state === profileData.state && 
            JSON.stringify(updateResult.entrance_exam || []) === JSON.stringify(profileData.entrance_exam) &&
            JSON.stringify(updateResult.interested_exams || []) === JSON.stringify(profileData.interested_exams)) {
          console.log('✅ Direct update successful and verified');
          // Fetch full profile
          const { data, error: fetchError } = await (supabase as any)
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          if (fetchError) throw fetchError;
          return data;
        } else {
          console.warn('⚠️ Update returned but data mismatch, using edge function');
          // Fall through to edge function
        }
      }
    }

    // Use edge function for phone auth users or if direct update failed
    console.log('Using edge function to update profile (bypasses RLS)');
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bvikkwalgbcembzxnpau.supabase.co";
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/smooth-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        userId,
        profileData,
      }),
    });

    let result;
    try {
      const responseText = await response.text();
      result = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error("Failed to parse response:", parseError);
      throw new Error("Invalid response from server");
    }

    if (!response.ok || !result.success) {
      const errorMessage = result.error || result.message || `Server error (${response.status})`;
      console.error('❌ Edge function update failed:', errorMessage);
      throw new Error(errorMessage);
    }

    console.log('✅ Profile updated via edge function:', result.profile);
    return result.profile;
  }

  /**
   * Notify all components of profile update
   */
  static notifyProfileUpdate() {
    window.dispatchEvent(new Event('profileUpdated'));
  }

  static async incrementFollowerCounts(followerId: string, followingId: string) {
    const [followersCount, followingCount] = await Promise.all([
      getFollowersCount(followingId),
      getFollowingCount(followerId),
    ]);

    await Promise.all([
      supabase
        .from('profiles')
        .update({ followers_count: followersCount })
        .eq('id', followingId),
      supabase
        .from('profiles')
        .update({ following_count: followingCount })
        .eq('id', followerId),
    ]);

    this.notifyProfileUpdate();
  }

  static async decrementFollowerCounts(followerId: string, followingId: string) {
    return this.incrementFollowerCounts(followerId, followingId);
  }

  static async refreshFollowerData(userId: string) {
    const [followersCount, followingCount] = await Promise.all([
      getFollowersCount(userId),
      getFollowingCount(userId),
    ]);

    await supabase
      .from('profiles')
      .update({
        followers_count: followersCount,
        following_count: followingCount,
      })
      .eq('id', userId);

    this.notifyProfileUpdate();
  }

  /**
   * Subscribe to profile changes (real-time)
   */
  static subscribeToProfile(
    userId: string,
    callback: (payload: any) => void
  ) {
    const channel = supabase
      .channel(`profile:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

