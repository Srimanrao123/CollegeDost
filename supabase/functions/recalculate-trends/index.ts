// @ts-nocheck
/// <reference types="https://deno.land/std@0.177.0/types.d.ts" />
// @ts-ignore - Deno runtime types
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore - Deno runtime types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// @ts-ignore - Deno.serve is available in Deno runtime
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // @ts-ignore - Deno.env is available in Deno runtime
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Try RPC first; if missing, compute in-line
    const { error } = await supabaseClient.rpc("recalculate_all_trend_scores");

    if (error) {
      // Fallback: fetch recent posts and update scores directly
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data: posts } = await supabaseClient
        .from('posts')
        .select('id, likes_count, comments_count, created_at')
        .gte('created_at', since)
        .limit(1000);

      if (posts && posts.length > 0) {
        for (const p of posts) {
          const likes = p.likes_count || 0;
          const comments = p.comments_count || 0;
          const hours = Math.max(1, (Date.now() - new Date(p.created_at).getTime()) / 3600000);
          const score = (likes + 2 * comments) / Math.pow(hours + 2, 1.5);
          await supabaseClient
            .from('posts')
            .update({ trend_score: score })
            .eq('id', p.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Trend scores recalculated successfully",
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
