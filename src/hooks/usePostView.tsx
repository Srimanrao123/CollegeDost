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

        // Check if view already exists (unique constraint is on post_id + user_id)
        const { data: existingView, error: checkError } = await (supabase as any)
          .from('post_views')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 is "not found" which is fine, other errors are real issues
          console.error('❌ Error checking existing view:', checkError);
        }

        const viewedAt = new Date().toISOString();

        if (existingView) {
          // View already exists - update the viewed_at timestamp
          console.log('📝 View exists, updating viewed_at timestamp');
          const { data: updateData, error: updateError } = await (supabase as any)
            .from('post_views')
            .update({ viewed_at: viewedAt })
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .select();

          if (updateError) {
            console.error('❌ Error updating view timestamp:', updateError);
          } else {
            console.log('✅ View timestamp updated successfully:', updateData);
          }
        } else {
          // View doesn't exist - insert new view
          const insertData: any = {
            post_id: postId,
            user_id: user.id,
            viewed_at: viewedAt
          };

          console.log('📝 Inserting new view:', insertData);

          const { data, error } = await (supabase as any)
            .from('post_views')
            .insert(insertData)
            .select();

          if (error) {
            // Handle duplicate key error gracefully (409 Conflict)
            // This can happen in race conditions where two requests try to insert simultaneously
            if (error.code === '23505' || error.code === 'PGRST116') {
              console.log('⚠️ Duplicate key detected (race condition), updating existing view');
              // Try to update instead
              const { data: updateData, error: updateError } = await (supabase as any)
                .from('post_views')
                .update({ viewed_at: viewedAt })
                .eq('post_id', postId)
                .eq('user_id', user.id)
                .select();

              if (updateError) {
                console.error('❌ Error updating view after conflict:', updateError);
              } else {
                console.log('✅ View updated after conflict:', updateData);
              }
            } else {
              console.error('❌ Error tracking view:', error);
              console.error('Error details:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
              });
            }
          } else {
            console.log('✅ View tracked successfully:', data);
          }
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
