/**
 * Generate Slug Edge Function
 * 
 * Generates SEO-friendly URL slugs using Google Gemini AI.
 * - Accepts post title, content, exam type, and optional image
 * - Uses Gemini 2.0 Flash model to generate topic-based slugs
 * - Returns slugified string
 * 
 * Required Environment Variables:
 * - GEMINI_API_KEY
 * - SUPABASE_URL (auto-set)
 * - SUPABASE_ANON_KEY (auto-set, for auth verification)
 */

// @ts-ignore - Deno runtime types
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore - Deno runtime types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405,
        }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Get user from Supabase auth
    // @ts-ignore - Deno.env is available in Deno runtime
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // @ts-ignore - Deno.env is available in Deno runtime
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch },
      auth: {
        persistSession: false,
      },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { title, content, examType, imageBase64, imageMimeType } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return new Response(
        JSON.stringify({ error: "Title is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Get Gemini API key
    // @ts-ignore - Deno.env is available in Deno runtime
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      console.warn("GEMINI_API_KEY not configured, using fallback slug");
      // Fallback to simple slug
      const fallbackSlug = slugify(title);
      return new Response(
        JSON.stringify({
          data: { slug: fallbackSlug },
          message: "Generated slug (fallback mode)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const hasImage = !!imageBase64 || !!imageMimeType;

    // Build prompt
    let instruction =
      "You help generate SEO-friendly URL slugs for an education Q&A website.\n";

    let contextLines: string[] = [];

    if (hasImage && imageBase64) {
      // IMAGE-ONLY MODE: Generate slug ONLY from image
      instruction +=
        "An image of the question is provided. You MUST generate the slug ONLY from the image content.\n" +
        "COMPLETELY IGNORE any title or content text that may have been provided.\n" +
        "Infer the MAIN topic/concept of the question ONLY from the image (and optional exam type).\n\n" +
        "Return a short topic phrase of 10-15 words, all lowercase, no punctuation except spaces.\n" +
        "Do NOT include exam names or generic words like 'question', 'doubt' unless absolutely necessary.\n";

      if (examType) {
        contextLines.push(`Exam type: ${examType}`);
      }
    } else {
      // TEXT MODE (no image): Generate slug from title + content + examType
      instruction +=
        "No image is provided. Infer the MAIN topic/concept of the question from the title, content, and exam type.\n\n" +
        "Return a short topic phrase of 10-15 words, all lowercase, no punctuation except spaces.\n" +
        "Do NOT include exam names or generic words like 'question', 'doubt' unless absolutely necessary.\n";

      contextLines = [
        title && `Title: ${title}`,
        examType && `Exam type: ${examType}`,
        content && `Content: ${content.slice(0, 800)}`,
      ].filter(Boolean) as string[];
    }

    const parts: any[] = [
      {
        text: instruction + (contextLines.length > 0 ? "\n\n" + contextLines.join("\n") : ""),
      },
    ];

    if (imageBase64 && imageMimeType) {
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: imageBase64,
        },
      });
    }

    const geminiBody = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 32,
      },
    };

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      // Fallback to simple slug
      const fallbackSlug = slugify(title);
      return new Response(
        JSON.stringify({
          data: { slug: fallbackSlug },
          message: "Generated slug (fallback mode - Gemini API error)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const geminiJson: any = await geminiResponse.json();
    const raw =
      geminiJson.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || "")
        .join(" ")
        .trim() || "";

    if (!raw) {
      // Fallback to simple slug
      const fallbackSlug = slugify(title);
      return new Response(
        JSON.stringify({
          data: { slug: fallbackSlug },
          message: "Generated slug (fallback mode - no Gemini response)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const firstLine = raw.split("\n")[0].trim();
    if (!firstLine) {
      const fallbackSlug = slugify(title);
      return new Response(
        JSON.stringify({
          data: { slug: fallbackSlug },
          message: "Generated slug (fallback mode)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const slug = slugify(firstLine);

    return new Response(
      JSON.stringify({
        data: { slug },
        message: "Slug generated successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Generate slug error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Try to extract title for fallback
    try {
      const body = await req.json();
      if (body?.title) {
        const fallbackSlug = slugify(body.title);
        return new Response(
          JSON.stringify({
            data: { slug: fallbackSlug },
            message: "Generated slug (fallback mode - error occurred)",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
    } catch {
      // Ignore
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

