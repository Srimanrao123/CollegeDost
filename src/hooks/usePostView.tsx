import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePostView(postId: string | undefined) {
  const { user } = useAuth();

  useEffect(() => {
    if (!postId) return;

    const trackView = async () => {
      try {
        // Only track views for logged-in users for now
        // Anonymous view tracking requires session_id column which may not be in schema cache yet
        if (!user?.id) {
          console.log('⚠️ View tracking skipped: User not logged in (session_id column may not be available in schema cache)');
          return;
        }

        console.log('👁️ Tracking view for post:', postId);
        console.log('👤 User: logged in (', user.id, ')');

        // De-duplicate views within the last hour per user
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        // Check for existing view (only check by user_id, skip session_id for now)
        const { data: existingView, error: checkError } = await (supabase as any)
          .from('post_views')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .gte('viewed_at', oneHourAgo)
          .limit(1)
          .maybeSingle();

        if (checkError) {
          console.error('❌ Error checking existing view:', checkError);
        }

        if (existingView) {
          // View already tracked
          console.log('✅ View already tracked within last hour');
          return;
        }

        // Prepare insert data - only include fields that definitely exist
        const insertData: any = {
          post_id: postId,
          user_id: user.id,
          viewed_at: new Date().toISOString()
        };

        // Only add session_id if we're sure the column exists (skip for now to avoid errors)
        // The migration has session_id, but PostgREST cache may not be updated yet

        console.log('📝 Inserting view:', insertData);

        // Insert new view
        const { data, error } = await (supabase as any)
          .from('post_views')
          .insert(insertData)
          .select();

        if (error) {
          console.error('❌ Error tracking view:', error);
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          });
        } else {
          console.log('✅ View tracked successfully:', data);
        }
      } catch (error) {
        console.error('❌ Error in trackView:', error);
      }
    };

    // Track view after a delay to ensure it's a meaningful view
    const timer = setTimeout(trackView, 2000);

    return () => clearTimeout(timer);
  }, [postId, user?.id]);
}

// Helper function to get or create anonymous session ID
function getOrCreateSessionId(): string {
  const key = 'anonymous_session_id';
  let sessionId = localStorage.getItem(key);
  
  if (!sessionId) {
    sessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(key, sessionId);
  }
  
  return sessionId;
}
