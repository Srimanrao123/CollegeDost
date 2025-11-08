// @ts-nocheck
/// <reference types="https://deno.land/std@0.177.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper function to format phone number for MSG91 (digits only, country code without +)
const formatPhoneForMsg91 = (phone: string): string => {
  let formatted = phone.replace(/\D/g, "");
  if (formatted.length === 10) {
    formatted = "91" + formatted;
  } else if (formatted.length === 11 && formatted.startsWith("0")) {
    formatted = "91" + formatted.substring(1);
  }
  return formatted;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
      );
    }

    const { phone, code } = await req.json();

    if (!phone || !code || code.length !== 4) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number and 4-digit code are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const MSG91_API_KEY = Deno.env.get("MSG91_API_KEY");
    const MSG91_OTP_BASE_URL = Deno.env.get("MSG91_OTP_BASE_URL") || "https://control.msg91.com/api/v5/otp";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!MSG91_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error("Missing required environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Step 1: Verify OTP with MSG91
    console.log(`📞 Starting OTP verification for phone: ${phone}`);
    const formattedPhone = formatPhoneForMsg91(phone);
    const formattedOtp = code.replace(/\D/g, "");
    const verifyUrl = `${MSG91_OTP_BASE_URL}/verify?authkey=${encodeURIComponent(MSG91_API_KEY)}&mobile=${encodeURIComponent(formattedPhone)}&otp=${encodeURIComponent(formattedOtp)}`;

    console.log(`Calling MSG91 verify API for phone: ${formattedPhone}`);
    const msg91Response = await fetch(verifyUrl, { method: "GET", headers: { "Content-Type": "application/json" } });
    const msg91Data = await msg91Response.json().catch(() => ({}));

    console.log(`MSG91 Response Status: ${msg91Response.status}, Data:`, msg91Data);

    if (msg91Data.type !== "success" && !(msg91Response.ok && !msg91Data.type)) {
      console.error(`❌ MSG91 OTP verification failed:`, msg91Data);
      return new Response(
        JSON.stringify({ success: false, error: msg91Data.message || "Invalid OTP" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`✅ OTP verified successfully for ${phone}`);

    // Step 2: Create or get user in Supabase Auth
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabasePhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
    const tempEmail = `phone_${phone.replace(/\D/g, "")}@temp.collegedost.com`;

    console.log(`📋 Formatted phone for Supabase: ${supabasePhone}`);
    console.log(`📧 Temporary email: ${tempEmail}`);

    // Step 2: Check if user exists in auth.users
    console.log(`🔍 Checking if user exists in auth.users...`);
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error(`❌ Error listing users:`, listError);
      throw new Error(`Failed to check existing users: ${listError.message}`);
    }

    console.log(`Total users in database: ${usersData?.users?.length || 0}`);
    
    let existingUser = usersData?.users?.find(
      (u) => u.phone === supabasePhone || u.phone?.replace(/\D/g, "") === phone.replace(/\D/g, "")
    );

    let userId: string;
    let userExists = false;
    
    if (existingUser) {
      // User exists
      userId = existingUser.id;
      userExists = true;
      console.log(`✅ Found existing user with ID: ${userId}, Phone: ${existingUser.phone}`);
    } else {
      // Create new user in auth.users
      console.log(`🆕 User does not exist. Creating new user in auth.users...`);
      console.log(`Creating user with phone: ${supabasePhone}, email: ${tempEmail}`);
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: supabasePhone,
        phone_confirmed: true,
        email: tempEmail,
        email_confirm: true,
        user_metadata: { phone: supabasePhone },
      });

      console.log(`Create user response - Has data: ${!!newUser}, Has error: ${!!createError}`);

      if (createError) {
        console.error(`❌ Error creating user:`, createError);
        console.error(`Error details - Message: ${createError.message}, Status: ${createError.status}`);
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      if (!newUser?.user) {
        console.error(`❌ No user object returned from createUser`);
        throw new Error("Failed to create user: No user object returned");
      }

      userId = newUser.user.id;
      existingUser = newUser.user;
      userExists = false;
      console.log(`✅ Successfully created new user in auth.users!`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Phone: ${existingUser.phone}`);
      console.log(`   Email: ${existingUser.email}`);
    }

    // Step 3: Generate session using Admin API
    console.log(`🔑 Starting session generation for user: ${userId}`);
    let sessionToken = null;
    let refreshToken = null;
    
    try {
      // Method 1: Try magic link approach
      console.log("Attempting magic link token generation...");
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: tempEmail,
      });

      if (linkError) {
        console.error("Magic link generation error:", linkError);
      }

      if (linkData?.properties?.action_link) {
        const url = new URL(linkData.properties.action_link);
        const magicLinkToken = url.searchParams.get("token");
        
        console.log(`Magic link token extracted: ${magicLinkToken ? "YES" : "NO"}`);
        
        if (magicLinkToken) {
          // Exchange the magic link token for a session using ANON KEY (not service role key)
          console.log("Exchanging magic link token for session...");
          const sessionResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=magiclink`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              token: magicLinkToken,
            }),
          });

          console.log(`Session exchange response status: ${sessionResponse?.status}`);

          if (sessionResponse?.ok) {
            const sessionData = await sessionResponse.json().catch(() => ({}));
            sessionToken = sessionData?.access_token;
            refreshToken = sessionData?.refresh_token;
            console.log(`✅ Generated session via magic link for user: ${userId}`);
            console.log(`Session token present: ${sessionToken ? "YES" : "NO"}`);
          } else {
            const errorText = await sessionResponse.text().catch(() => "unknown error");
            console.warn(`Failed to exchange magic link token: ${errorText}`);
          }
        }
      }

      // Method 2: Fallback - Generate temporary password and sign in
      if (!sessionToken) {
        console.log("Magic link method failed, trying password method...");
        const tempPassword = `TempPass_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        // Update user with temporary password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: tempPassword,
        });

        if (updateError) {
          console.error("Failed to set temporary password:", updateError);
        } else {
          console.log("Temporary password set, attempting sign in...");
          
          // Sign in with temporary password to get session
          const signInResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              email: tempEmail,
              password: tempPassword,
            }),
          });

          if (signInResponse?.ok) {
            const sessionData = await signInResponse.json().catch(() => ({}));
            sessionToken = sessionData?.access_token;
            refreshToken = sessionData?.refresh_token;
            console.log(`✅ Generated session via password for user: ${userId}`);
            console.log(`Session token present: ${sessionToken ? "YES" : "NO"}`);
          } else {
            const errorText = await signInResponse.text().catch(() => "unknown error");
            console.error(`Failed to sign in with password: ${errorText}`);
          }
        }
      }
    } catch (error) {
      console.error("Error generating session:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
    }

    console.log(`Final session status - Token: ${sessionToken ? "PRESENT" : "MISSING"}, Refresh: ${refreshToken ? "PRESENT" : "MISSING"}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "OTP verified and user authenticated",
        user: {
          id: userId,
          phone: existingUser.phone,
          email: existingUser.email,
        },
        userExists: userExists,
        session: sessionToken ? {
          access_token: sessionToken,
          refresh_token: refreshToken || null,
          expires_at: null,
        } : null,
        // If no session token, client will need to sign in
        requiresClientSignIn: !sessionToken,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to verify OTP";
    console.error(`❌ Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
