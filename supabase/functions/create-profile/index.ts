// @ts-nocheck
/// <reference types="https://deno.land/std@0.177.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // Parse request body
    const { phone, username } = await req.json();

    if (!phone || !username) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number and username are required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Validate required environment variables
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ Supabase configuration is missing!");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Supabase credentials not set",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create user in Supabase Auth using Admin API
    // Generate a temporary email for phone-only users (Supabase requires email or phone)
    const tempEmail = `phone_${phone.replace(/\D/g, "")}@temp.collegedost.com`;

    const createUserResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        phone: phone,
        phone_confirmed: true,
        email: tempEmail,
        email_confirm: true,
        user_metadata: {
          username: username,
          phone: phone,
        },
      }),
    });

    let userData;
    try {
      const responseText = await createUserResponse.text();
      userData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error("❌ Failed to parse Supabase response:", parseError);
      throw new Error("Invalid response from Supabase");
    }

    let userId: string | null = null;

    if (!createUserResponse.ok) {
      console.error(`❌ Supabase create user failed:`, {
        status: createUserResponse.status,
        statusText: createUserResponse.statusText,
        error: userData,
      });

      // If user already exists, try to get the existing user
      const createErrorMsg = userData.error?.message || userData.message || "";
      if (
        createErrorMsg.includes("already registered") ||
        createErrorMsg.includes("already exists") ||
        createErrorMsg.includes("duplicate") ||
        createUserResponse.status === 422 ||
        createUserResponse.status === 400
      ) {
        console.log(`ℹ️  User may already exist, trying to find by phone: ${phone}`);

        // Try to find user by phone - Supabase Admin API search
        const findUserResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
          },
        });

        if (findUserResponse.ok) {
          const usersData = await findUserResponse.json();
          const users = usersData.users || [];

          // Find user by phone number
          const existingUser = users.find(
            (u: any) => u.phone === phone || u.phone === phone.replace(/^\+/, "")
          );

          if (existingUser) {
            console.log(`✅ Found existing user: ${existingUser.id}`);
            userId = existingUser.id;

            // Update user metadata
            await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                apikey: SUPABASE_SERVICE_ROLE_KEY,
              },
              body: JSON.stringify({
                user_metadata: {
                  ...existingUser.user_metadata,
                  username: username,
                },
              }),
            });

            // Create or update profile
            const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Prefer: "resolution=merge-duplicates",
              },
              body: JSON.stringify({
                id: existingUser.id,
                username: username,
                phone_no: phone,
                followers_count: 0,
                following_count: 0,
                onboarding_completed: false,
                entrance_exam: [],
                interested_exams: [],
              }),
            });

            if (!profileResponse.ok) {
              const profileError = await profileResponse.json();
              // If profile exists, update it
              if (profileResponse.status === 409 || profileError.code === "23505") {
                const updateResponse = await fetch(
                  `${SUPABASE_URL}/rest/v1/profiles?id=eq.${existingUser.id}`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                      apikey: SUPABASE_SERVICE_ROLE_KEY,
                    },
                    body: JSON.stringify({
                      username: username,
                      phone_no: phone,
                      updated_at: new Date().toISOString(),
                    }),
                  }
                );

                if (!updateResponse.ok) {
                  throw new Error("Failed to update profile");
                }
              } else {
                throw profileError;
              }
            }

            return new Response(
              JSON.stringify({
                success: true,
                userId: existingUser.id,
                profileId: existingUser.id,
                message: "User account created successfully",
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              }
            );
          } else {
            console.log(
              `⚠️  User not found by phone, but error suggests user exists. Creating profile directly...`
            );
            // If we can't find the user but got an error suggesting it exists,
            // try to create profile with a generated ID (fallback - not ideal)
            // This shouldn't happen, but handle it gracefully
            throw new Error("User may exist but could not be retrieved. Please try again.");
          }
        } else {
          console.error(`❌ Failed to fetch users list: ${findUserResponse.status}`);
        }
      }

      // Provide detailed error message
      const detailedErrorMsg =
        userData.error?.message || userData.message || userData.error || "Unknown error";
      const detailedError = `Supabase API error (${createUserResponse.status}): ${detailedErrorMsg}`;
      console.error(`❌ ${detailedError}`);
      console.error(`❌ Full Supabase response:`, JSON.stringify(userData, null, 2));
      throw new Error(detailedError);
    }

    userId = userData.id;

    if (!userId) {
      throw new Error("Failed to get user ID from Supabase");
    }

    // Create profile in database
    const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: userId,
        username: username,
        phone_no: phone,
        followers_count: 0,
        following_count: 0,
        onboarding_completed: false,
        entrance_exam: [],
        interested_exams: [],
      }),
    });

    if (!profileResponse.ok) {
      const profileError = await profileResponse.json();
      // If profile already exists, update it
      if (profileResponse.status === 409 || profileError.code === "23505") {
        const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            username: username,
            phone_no: phone,
            updated_at: new Date().toISOString(),
          }),
        });

        if (!updateResponse.ok) {
          throw new Error("Failed to update profile");
        }
      } else {
        throw profileError;
      }
    }

    console.log(`✅ User and profile created successfully for ${phone} (${userId})`);

    return new Response(
      JSON.stringify({
        success: true,
        userId: userId,
        profileId: userId,
        message: "User account and profile created successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to create user account";
    console.error(`❌ Error creating user: ${errorMessage}`);
    console.error(`❌ Error stack:`, err instanceof Error ? err.stack : "");

    // Check if it's a configuration error
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let finalErrorMessage = errorMessage;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      finalErrorMessage =
        "Server configuration error: Supabase credentials not set. Please check server/.env file.";
      console.error("❌ Missing Supabase configuration!");
      console.error(`   SUPABASE_URL: ${SUPABASE_URL ? "Set" : "Missing"}`);
      console.error(
        `   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Missing"}`
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: finalErrorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
