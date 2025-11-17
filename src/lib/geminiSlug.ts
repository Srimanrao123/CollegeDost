// lib/geminiSlug.ts
type GenerateSlugParams = {
  title: string;
  content?: string | null;
  examType?: string | null;
  imageBase64?: string | null;
  imageMimeType?: string;
  imageUrl?: string | null; // optional fallback context
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? "present" : "missing");

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function generateSimpleSlug(rawTitle: string): string {
  if (!rawTitle?.trim()) {
    return `post-${Date.now()}`;
  }
  return slugify(rawTitle);
}

export async function generateSlugWithGemini(
  params: GenerateSlugParams
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.warn("Missing GEMINI API key. Falling back to simple slug.");
    return null;
  }

  const { title, content, examType, imageBase64, imageMimeType, imageUrl } =
    params;

  const hasImage = !!imageBase64 || !!imageUrl;

  // -------- build prompt depending on image presence --------
  let instruction =
    "You help generate SEO-friendly URL slugs for an education Q&A website.\n";

  let contextLines: string[] = [];

  if (hasImage) {
    // IMAGE-ONLY MODE: Generate slug ONLY from image (and optionally examType)
    // DO NOT include title or content in the prompt
    instruction +=
      "An image of the question is provided. You MUST generate the slug ONLY from the image content.\n" +
      "COMPLETELY IGNORE any title or content text that may have been provided.\n" +
      "Infer the MAIN topic/concept of the question ONLY from the image (and optional exam type).\n\n" +
      "Return a short topic phrase of 10-15 words, all lowercase, no punctuation except spaces.\n" +
      "Do NOT include exam names or generic words like 'question', 'doubt' unless absolutely necessary.\n";

    // Only include examType if provided - DO NOT include title or content
    if (examType) {
      contextLines.push(`Exam type: ${examType}`);
    }
  } else {
    // TEXT MODE (no image): Generate slug from title + content + examType
    instruction +=
      "No image is provided. Infer the MAIN topic/concept of the question from the title, content, and exam type.\n\n" +
      "Return a short topic phrase of 10-15 words, all lowercase, no punctuation except spaces.\n" +
      "Do NOT include exam names or generic words like 'question', 'doubt' unless absolutely necessary.\n";

    // Include title, content, and examType in text mode
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
    // Add image as inline data
    parts.push({
      inlineData: {
        mimeType: imageMimeType,
        data: imageBase64,
      },
    });
  } else if (imageUrl && hasImage) {
    // Fallback: if we only have imageUrl (no base64), mention it but note it may not be accessible
    // This is a fallback scenario - ideally we should have imageBase64
    parts.push({
      text: `\n\nNote: An image URL is available but may not be accessible: ${imageUrl}`,
    });
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 32,
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      console.error("Gemini slug API error:", await res.text());
      return null;
    }

    const json: any = await res.json();
    const raw =
      json.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || "")
        .join(" ")
        .trim() || "";

    if (!raw) return null;

    const firstLine = raw.split("\n")[0].trim();
    if (!firstLine) return null;

    return slugify(firstLine);
  } catch (err) {
    console.error("Gemini slug generation failed:", err);
    return null;
  }
}
