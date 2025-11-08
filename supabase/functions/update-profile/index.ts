// @ts-nocheck
/// <reference types="https://deno.land/std@0.177.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405,
        }
      );
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { userId, profileData } = requestBody;

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "User ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!profileData) {
      return new Response(
        JSON.stringify({ success: false, error: "Profile data is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (profileData.state !== undefined) updateData.state = profileData.state;
    if (profileData.username !== undefined) updateData.username = profileData.username;
    if (profileData.phone_no !== undefined) updateData.phone_no = profileData.phone_no;
    if (profileData.avatar_url !== undefined) updateData.avatar_url = profileData.avatar_url;
    if (profileData.bio !== undefined) updateData.bio = profileData.bio;
    if (profileData.onboarding_completed !== undefined) {
      updateData.onboarding_completed = profileData.onboarding_completed;
    }

    // Handle array fields
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

    // Update profile using service role (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating profile:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, profile: data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

