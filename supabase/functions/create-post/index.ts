/**
 * Create Post Edge Function
 * 
 * Creates a new post with optional image upload, tag processing, and slug generation.
 * - Creates post in Supabase database
 * - Optionally uploads image to R2 (if provided)
 * - Processes hashtags and creates tag relationships
 * - Generates SEO-friendly slug using Gemini AI (if enabled)
 * 
 * Required Environment Variables:
 * - SUPABASE_URL (auto-set)
 * - SUPABASE_SERVICE_ROLE_KEY (auto-set)
 * - R2_ACCOUNT_ID (if image upload needed)
 * - R2_ACCESS_KEY_ID (if image upload needed)
 * - R2_SECRET_ACCESS_KEY (if image upload needed)
 * - R2_BUCKET_NAME (default: "post-upload")
 * - R2_PUBLIC_DOMAIN (optional)
 * - GEMINI_API_KEY (optional, for slug generation)
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

function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  if (!matches) return [];
  return matches.map((tag) => tag.slice(1).toLowerCase());
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

    // Get Supabase clients
    // @ts-ignore - Deno.env is available in Deno runtime
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // @ts-ignore - Deno.env is available in Deno runtime
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // @ts-ignore - Deno.env is available in Deno runtime
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch },
      auth: {
        persistSession: false,
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      global: { fetch },
      auth: {
        persistSession: false,
      },
    });

    // Verify user token
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
    const contentType = req.headers.get("content-type") || "";
    let body: any;

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart form data (with image file)
      const formData = await req.formData();
      body = {
        title: formData.get("title") as string,
        content: formData.get("content") as string | null,
        category: formData.get("category") as string,
        examType: formData.get("examType") as string | null,
        postType: formData.get("postType") as string || "Text",
        linkUrl: formData.get("linkUrl") as string | null,
        topicId: formData.get("topicId") as string | null,
        image: formData.get("image") as File | null,
        imageBase64: formData.get("imageBase64") as string | null,
        imageMimeType: formData.get("imageMimeType") as string | null,
      };
    } else {
      // Handle JSON
      body = await req.json();
    }

    const {
      title,
      content,
      category,
      examType,
      postType = "Text",
      linkUrl,
      topicId,
      image,
      imageBase64,
      imageMimeType,
    } = body;

    // Validate required fields
    if (!title || typeof title !== "string" || !title.trim()) {
      return new Response(
        JSON.stringify({ error: "Title is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (title.length > 300) {
      return new Response(
        JSON.stringify({ error: "Title must be less than 300 characters" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (!examType) {
      return new Response(
        JSON.stringify({ error: "Exam type is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (postType === "Link" && !linkUrl) {
      return new Response(
        JSON.stringify({ error: "URL is required for link posts" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Generate slug
    let generatedSlug: string;
    // @ts-ignore - Deno.env is available in Deno runtime
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    
    if (geminiApiKey && (imageBase64 || image)) {
      // Try Gemini slug generation
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
        
        const hasImage = !!imageBase64 || !!image;
        let instruction = "You help generate SEO-friendly URL slugs for an education Q&A website.\n";
        let contextLines: string[] = [];
        const parts: any[] = [];

        if (hasImage && imageBase64) {
          instruction +=
            "An image of the question is provided. You MUST generate the slug ONLY from the image content.\n" +
            "COMPLETELY IGNORE any title or content text that may have been provided.\n" +
            "Infer the MAIN topic/concept of the question ONLY from the image (and optional exam type).\n\n" +
            "Return a short topic phrase of 10-15 words, all lowercase, no punctuation except spaces.\n" +
            "Do NOT include exam names or generic words like 'question', 'doubt' unless absolutely necessary.\n";
          
          if (examType) {
            contextLines.push(`Exam type: ${examType}`);
          }

          parts.push({
            text: instruction + (contextLines.length > 0 ? "\n\n" + contextLines.join("\n") : ""),
          });

          parts.push({
            inlineData: {
              mimeType: imageMimeType || "image/jpeg",
              data: imageBase64,
            },
          });
        } else {
          instruction +=
            "No image is provided. Infer the MAIN topic/concept of the question from the title, content, and exam type.\n\n" +
            "Return a short topic phrase of 10-15 words, all lowercase, no punctuation except spaces.\n" +
            "Do NOT include exam names or generic words like 'question', 'doubt' unless absolutely necessary.\n";

          contextLines = [
            title && `Title: ${title}`,
            examType && `Exam type: ${examType}`,
            content && `Content: ${content?.slice(0, 800)}`,
          ].filter(Boolean) as string[];

          parts.push({
            text: instruction + (contextLines.length > 0 ? "\n\n" + contextLines.join("\n") : ""),
          });
        }

        const geminiBody = {
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 32,
          },
        };

        const geminiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        });

        if (geminiResponse.ok) {
          const geminiJson: any = await geminiResponse.json();
          const raw =
            geminiJson.candidates?.[0]?.content?.parts
              ?.map((p: any) => p.text || "")
              .join(" ")
              .trim() || "";

          if (raw) {
            const firstLine = raw.split("\n")[0].trim();
            if (firstLine) {
              generatedSlug = slugify(firstLine);
            } else {
              generatedSlug = slugify(title);
            }
          } else {
            generatedSlug = slugify(title);
          }
        } else {
          generatedSlug = slugify(title);
        }
      } catch (error) {
        console.error("Gemini slug generation error:", error);
        generatedSlug = slugify(title);
      }
    } else {
      // Fallback to simple slug
      generatedSlug = slugify(title);
    }

    // Create post (without image first)
    const trimmedTitle = title.trim();
    const trimmedContent = content?.trim() || null;

    const postData: any = {
      user_id: user.id,
      slug: generatedSlug,
      title: trimmedTitle,
      content: trimmedContent,
      image_r2_key: null,
      image_r2_migrated: false,
      link_url: postType === "Link" ? linkUrl?.trim() || null : null,
      topic_id: topicId || null,
      category: category || "Entrance Exam",
      post_type: postType,
      exam_type: examType,
      likes_count: 0,
      comments_count: 0,
    };

    const { data: newPost, error: postError } = await supabaseAdmin
      .from("posts")
      .insert([postData])
      .select()
      .single();

    if (postError) {
      console.error("Post insert error:", postError);
      return new Response(
        JSON.stringify({ error: `Failed to create post: ${postError.message}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    let imageR2Key: string | null = null;

    // Upload image if provided
    if ((image || imageBase64) && newPost?.id && (postType === "Image" || postType === "Video")) {
      // For now, return the post without image upload
      // Image upload should be handled separately via upload-post-image function
      // This keeps the function simpler and allows for better error handling
      // The frontend can call upload-post-image after post creation
    }

    // Process tags
    const fullText = `${trimmedTitle} ${trimmedContent || ""}`;
    const hashtags = extractHashtags(fullText);

    if (hashtags.length > 0 && newPost?.id) {
      for (const tagName of hashtags) {
        try {
          const validTag = tagName.trim().toLowerCase();
          if (!validTag || validTag.length > 50) continue;

          // Upsert tag
          const { data: tag, error: tagError } = await supabaseAdmin
            .from("tags")
            .upsert(
              { name: validTag },
              {
                onConflict: "name",
                ignoreDuplicates: false,
              }
            )
            .select()
            .single();

          let tagId: string | null = null;

          if (tagError) {
            // Try to fetch existing tag
            const { data: existingTag } = await supabaseAdmin
              .from("tags")
              .select("id")
              .eq("name", validTag)
              .single();

            if (existingTag) {
              tagId = existingTag.id;
            } else {
              continue;
            }
          } else if (tag) {
            tagId = tag.id;
          }

          if (tagId) {
            // Link tag to post
            await supabaseAdmin
              .from("post_tags")
              .insert({ post_id: newPost.id, tag_id: tagId })
              .select();
            // Ignore duplicate errors
          }
        } catch (tagError) {
          console.error(`Error processing tag ${tagName}:`, tagError);
          // Continue with other tags
        }
      }
    }

    return new Response(
      JSON.stringify({
        data: {
          post: newPost,
          imageR2Key,
          hashtags,
        },
        message: "Post created successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Create post error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

