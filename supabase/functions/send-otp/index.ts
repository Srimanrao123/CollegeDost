// @ts-nocheck
/// <reference types="https://deno.land/std@0.177.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Validate required environment variables
    const MSG91_API_KEY = Deno.env.get("MSG91_API_KEY");
    const MSG91_OTP_BASE_URL = Deno.env.get("MSG91_OTP_BASE_URL") || "https://control.msg91.com/api/v5/otp";
    const MSG91_TEMPLATE_ID = Deno.env.get("MSG91_TEMPLATE_ID");
    const MSG91_OTP_EXPIRY = Deno.env.get("MSG91_OTP_EXPIRY") || "30";

    if (!MSG91_API_KEY) {
      console.error("❌ MSG91_API_KEY is not configured!");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: MSG91_API_KEY is not set. Please configure environment variables.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    if (!MSG91_TEMPLATE_ID) {
      console.error("❌ MSG91_TEMPLATE_ID is not configured!");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: MSG91_TEMPLATE_ID is not set. Please configure environment variables.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Format phone number - remove spaces
    const formattedPhone = phone.replace(/\s+/g, "");

    // Validate phone number format
    if (!formattedPhone || formattedPhone.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid phone number format. Please include country code (e.g., +91 for India)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Build MSG91 OTP API URL with query parameters
    const url = `${MSG91_OTP_BASE_URL}?mobile=${encodeURIComponent(formattedPhone)}&authkey=${encodeURIComponent(MSG91_API_KEY)}&otp_expiry=${MSG91_OTP_EXPIRY}&template_id=${encodeURIComponent(MSG91_TEMPLATE_ID)}&realTimeResponse=`;

    // Optional template parameters (if needed)
    const templateParams = {}; // Can be extended if needed

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(templateParams),
    });

    let responseText;
    let data;

    try {
      responseText = await response.text();
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error("❌ Failed to parse MSG91 response");
      data = { type: "error", message: "Invalid response from MSG91" };
    }

    // MSG91 OTP API success indicators
    const isSuccess =
      response.ok &&
      (data.type === "success" ||
        data.message?.toLowerCase().includes("success") ||
        data.message?.toLowerCase().includes("otp sent") ||
        data.message?.toLowerCase().includes("sent successfully") ||
        data.request_id ||
        data.id ||
        (response.status === 200 && !data.type)); // 200 without error type

    if (isSuccess) {
      const requestId = data.request_id || data.id || null;
      console.log(
        `✅ OTP sent successfully to ${formattedPhone}${requestId ? ` (Request ID: ${requestId})` : ""}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          message:
            "OTP sent successfully. Please check your phone. If not received, check spam folder or wait a few seconds.",
          requestId: requestId,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      // MSG91 error format
      const errorMessage =
        data.message ||
        data.msg ||
        data.errors?.[0]?.message ||
        (Array.isArray(data.errors) ? data.errors[0] : null) ||
        data.error ||
        (response.status === 401
          ? "Invalid API Key or authentication failed. Check your MSG91_API_KEY."
          : null) ||
        (response.status === 400
          ? "Invalid request. Verify template_id is correct and template is approved."
          : null) ||
        "Failed to send OTP";

      console.error(`❌ Failed to send OTP: ${errorMessage}`);

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: response.status || 400,
        }
      );
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to send OTP";
    console.error(`❌ Error sending OTP: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
