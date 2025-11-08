import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Removes tag mentions from content text if tags are already displayed separately
 * @param content - The post content text
 * @param tags - Array of tags that are displayed as badges
 * @returns Content with tag mentions removed
 */
export function removeTagsFromContent(content: string | null | undefined, tags: string[] = []): string {
  if (!content || tags.length === 0) {
    return content || "";
  }

  let cleanedContent = content;

  // Remove each tag from content (handles both #tag and tag formats)
  tags.forEach((tag) => {
    // Escape special regex characters in tag
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    // Remove #tag with optional spaces before/after
    cleanedContent = cleanedContent.replace(
      new RegExp(`#${escapedTag}\\b`, "gi"),
      ""
    );
    
    // Remove standalone tag word (only if it's a word boundary to avoid partial matches)
    cleanedContent = cleanedContent.replace(
      new RegExp(`\\b${escapedTag}\\b`, "gi"),
      ""
    );
  });

  // Clean up multiple spaces and newlines
  cleanedContent = cleanedContent
    .replace(/\s+/g, " ") // Multiple spaces to single space
    .replace(/\n\s*\n/g, "\n") // Multiple newlines to single newline
    .trim(); // Remove leading/trailing whitespace

  return cleanedContent;
}