import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TextEditor } from "@/components/posts/TextEditor";
import { ImageUpload } from "@/components/posts/ImageUpload";
import { X } from "lucide-react";
import examsData from "@/utils/exams.json";
import { Badge } from "@/components/ui/badge";
import {
  generateSlugWithGemini,
  generateSimpleSlug,
} from "@/lib/geminiSlug";

// ----------------- helpers (outside component) -----------------

interface Topic {
  id: string;
  name: string;
  description?: string;
}

const extractHashtags = (text: string): string[] => {
  const hashtagRegex = /#\w+/g;
  const matches = text.match(hashtagRegex);
  if (!matches) return [];
  return [...new Set(matches.map((tag) => tag.substring(1).toLowerCase()))];
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1]; // "data:image/png;base64,AAAA..." -> just the data
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ----------------------------------------------------------------

export default function CreatePostPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [postType, setPostType] = useState<"Text" | "Image" | "Video" | "Link" | "Poll">("Text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProgress, setShowProgress] = useState(false); // you may be using this with ProgressBar elsewhere
  const [selectedExamType, setSelectedExamType] = useState<string>("");

  const isValidSelection = !!selectedExamType;

  // --------------- exams with categories ----------------

  const allExamsWithCategories = useMemo(() => {
    const exams: Array<{ value: string; label: string; category: string }> = [];

    (examsData.board_exams?.CBSE || []).forEach((exam) => {
      exams.push({ value: exam, label: exam, category: "CBSE Board" });
    });

    (examsData.board_exams?.StateBoard || []).forEach((exam) => {
      exams.push({ value: exam, label: exam, category: "State Board" });
    });

    (examsData.entrance_exams || []).forEach((exam) => {
      exams.push({ value: exam, label: exam, category: "Entrance Exam" });
    });

    return exams;
  }, []);

  const groupedExams = useMemo(() => {
    const groups: Record<string, typeof allExamsWithCategories> = {};
    allExamsWithCategories.forEach((exam) => {
      if (!groups[exam.category]) {
        groups[exam.category] = [];
      }
      groups[exam.category].push(exam);
    });
    return groups;
  }, [allExamsWithCategories]);

  // --------------- fetch topics ----------------

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("topics")
          .select("id, name, description")
          .order("name", { ascending: true });

        if (error) throw error;
        setTopics((data || []) as Topic[]);
      } catch (error: any) {
        console.error("Error fetching topics:", error);
        toast({
          title: "Error",
          description: "Failed to load topics. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoadingTopics(false);
      }
    };

    fetchTopics();
  }, [toast]);

  // --------------- load draft ----------------

  useEffect(() => {
    const draft = localStorage.getItem("post_draft");
    if (!draft) return;

    try {
      const parsed = JSON.parse(draft);
      setTitle(parsed.title || "");
      setContent(parsed.content || "");
      setSelectedTags(parsed.tags || []);
      setPostType(parsed.postType || "Text");
      setLinkUrl(parsed.linkUrl || "");
      setSelectedTopicId(parsed.topicId || "");
      setSelectedExamType(parsed.examType || "");
    } catch (error) {
      console.error("Error loading draft:", error);
    }
  }, []);

  // --------------- auto-extract hashtags ----------------

  useEffect(() => {
    const extracted = extractHashtags(content + " " + title);
    const newTags = extracted.filter((tag) => !selectedTags.includes(tag));
    if (newTags.length > 0) {
      setSelectedTags((prev) => [...new Set([...prev, ...extracted])]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title]);

  // --------------- save draft ----------------

  const saveDraft = () => {
    const draft = {
      title,
      content,
      tags: selectedTags,
      postType,
      linkUrl,
      topicId: selectedTopicId,
      examType: selectedExamType,
    };
    localStorage.setItem("post_draft", JSON.stringify(draft));
    toast({
      title: "Draft saved",
      description: "Your post has been saved as a draft",
    });
  };

  // --------------- image handling ----------------

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    setImageBase64(null);
    setImageMimeType(null);

    if (!file) {
      setImagePreview("");
      return;
    }

    setImageMimeType(file.type || "image/png");

    // preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // base64 for Gemini (no need to await in the handler)
    fileToBase64(file)
      .then((base64) => setImageBase64(base64))
      .catch((err) => {
        console.error("Error converting image to base64:", err);
        setImageBase64(null);
      });
  };

  // --------------- upload image to R2 ----------------

  /**
   * Upload image to R2 after post creation
   * Requires postId to use format: post-upload/<post_id>/<filename>.webp
   * Images are automatically converted to WebP format
   */
  const uploadImageToR2 = async (postId: string): Promise<string | null> => {
    if (!imageFile || !user) {
      return null;
    }

    try {
      console.log("🔄 Uploading image to R2...", {
        fileName: imageFile.name,
        fileSize: imageFile.size,
        userId: user.id,
        postId,
      });
      
      const { uploadImageToR2: uploadR2 } = await import("@/lib/r2Upload");
      
      const result = await uploadR2({
        file: imageFile,
        userId: user.id,
        postId: postId,
        folder: 'post-upload',
      });
      
      console.log("✅ Image uploaded to R2 successfully:", result.key);
      return result.key;
    } catch (error: any) {
      console.error("❌ R2 upload failed:", {
        error: error?.message || error,
        stack: error?.stack,
        name: error?.name,
      });
      throw error; // Re-throw to handle in calling code
    }
  };

  // --------------- process tags ----------------

  const processPostTags = async (postId: string, hashtags: string[]) => {
    if (!hashtags || hashtags.length === 0) return;

    try {
      const validTags = hashtags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && tag.length <= 50);

      if (validTags.length === 0) return;

      for (const tagName of validTags) {
        try {
          const { data: tag, error: tagError } = await (supabase as any)
            .from("tags")
            .upsert(
              { name: tagName },
              {
                onConflict: "name",
                ignoreDuplicates: false,
              }
            )
            .select()
            .single();

          let tagId: string | null = null;

          if (tagError) {
            console.error("Error upserting tag:", tagError);

            const { data: existingTag, error: fetchError } = await (supabase as any)
              .from("tags")
              .select("id")
              .eq("name", tagName)
              .single();

            if (fetchError) {
              console.error("Error fetching existing tag:", fetchError);
              continue;
            }

            if (existingTag) {
              tagId = existingTag.id;
            } else {
              continue;
            }
          } else if (tag) {
            tagId = tag.id;
          }

          if (tagId) {
            const { error: linkError } = await (supabase as any)
              .from("post_tags")
              .insert({ post_id: postId, tag_id: tagId })
              .select();

            if (linkError) {
              if (
                linkError.code === "23505" ||
                linkError.message?.includes("duplicate")
              ) {
                console.log(`Tag ${tagName} already linked to post`);
              } else {
                console.error("Error linking tag to post:", linkError);
              }
            }
          }
        } catch (tagProcessingError) {
          console.error(`Error processing tag ${tagName}:`, tagProcessingError);
          continue;
        }
      }
    } catch (error) {
      console.error("Error processing tags:", error);
    }
  };

  // --------------- submit handler ----------------

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a post",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your post",
        variant: "destructive",
      });
      return;
    }

    if (title.length > 300) {
      toast({
        title: "Title too long",
        description: "Title must be less than 300 characters",
        variant: "destructive",
      });
      return;
    }

    if (!selectedExamType) {
      toast({
        title: "Exam Type Required",
        description: "Please select an Exam Type",
        variant: "destructive",
      });
      return;
    }

    if (postType === "Link" && !linkUrl.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a URL for your link post",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setShowProgress(true);

    try {
      // Step 1: Create post first (without image) to get post_id
      // Step 2: Upload image to R2 using post_id
      // Step 3: Update post with image_r2_key

      // Determine category from selected exam type
      let category: "Entrance Exam" | "Board Exam" = "Entrance Exam";
      if (selectedExamType) {
        const examInfo = allExamsWithCategories.find(
          (e) => e.value === selectedExamType
        );
        if (
          examInfo?.category === "CBSE Board" ||
          examInfo?.category === "State Board"
        ) {
          category = "Board Exam";
        }
      }

      const trimmedTitle = title.trim();
      const trimmedContent = content.trim() || null;

      const extractedHashtags = extractHashtags(
        `${trimmedTitle} ${trimmedContent || ""}`
      );

      // ------------- Gemini-based slug generation -------------
      let generatedSlug: string;

      try {
        // For Gemini, use base64 image (R2 key doesn't work directly with Gemini)
        const geminiSlug = await generateSlugWithGemini({
          title: trimmedTitle,
          content: trimmedContent,
          examType: selectedExamType,
          imageBase64: imageBase64,
          imageMimeType: imageMimeType || undefined,
          imageUrl: undefined, // No longer using image_url
        });
        console.log("Gemini slug response:", geminiSlug);
        if (geminiSlug) {
          generatedSlug = geminiSlug;
          console.log("Generated slug from Gemini:", geminiSlug);
        } else {
          generatedSlug = generateSimpleSlug(trimmedTitle);
        }
      } catch (error) {
        console.error("Error generating slug with Gemini, using fallback:", error);
        generatedSlug = generateSimpleSlug(trimmedTitle);
      }

      // ------------- build post payload (without image first) -------------

      const postData: any = {
        user_id: user.id,
        slug: generatedSlug,
        title: trimmedTitle,
        content: trimmedContent,
        image_r2_key: null, // Will be updated after upload
        image_r2_migrated: false, // Will be updated after upload
        link_url: postType === "Link" ? linkUrl.trim() : null,
        topic_id: selectedTopicId || null,
        category,
        post_type: postType,
        exam_type: selectedExamType,
        likes_count: 0,
        comments_count: 0,
      };

      // Step 1: Create post first to get post_id
      const { data: newPost, error: postError } = await (supabase as any)
        .from("posts")
        .insert([postData])
        .select()
        .single();

      if (postError) {
        console.error("Post insert error:", postError);
        throw postError;
      }

      // Step 2: Upload image to R2 if present (using post_id)
      let imageR2Key: string | null = null;
      if (imageFile && (postType === "Image" || postType === "Video") && newPost?.id) {
        try {
          imageR2Key = await uploadImageToR2(newPost.id);
          
          // Step 3: Update post with image_r2_key
          if (imageR2Key) {
            const { error: updateError } = await (supabase as any)
              .from("posts")
              .update({
                image_r2_key: imageR2Key,
                image_r2_migrated: true,
              })
              .eq("id", newPost.id);

            if (updateError) {
              console.error("Failed to update post with image_r2_key:", updateError);
              // Don't throw - post is created, just image update failed
            }
          }
        } catch (uploadError: any) {
          console.error("Image upload failed:", uploadError);
          // Post is already created, but image upload failed
          // Optionally: delete the post or show warning
          toast({
            title: "Post created, but image upload failed",
            description: uploadError.message || "Your post was created but the image could not be uploaded.",
            variant: "destructive",
          });
        }
      }

      if (extractedHashtags.length > 0 && newPost) {
        await processPostTags(newPost.id, extractedHashtags);
      }

      localStorage.removeItem("post_draft");

      window.dispatchEvent(
        new CustomEvent("tagsUpdated", {
          detail: { tags: extractedHashtags },
        })
      );

      toast({
        title: "Post created successfully!",
        description: "Your post has been published",
      });

      setTimeout(() => {
        navigate(`/`);
      }, 1000);
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast({
        title: "Failed to create post",
        description: error.message || "An error occurred while creating your post",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowProgress(false);
    }
  };

  // --------------- JSX ----------------

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Create Post
        </h1>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <Card className="p-6 space-y-6">
        {/* Exam Type Selection */}
        <div>
          <Label className="text-sm font-medium mb-3 block">
            Select Exam Type <span className="text-destructive">*</span>
          </Label>

          <Tabs
            defaultValue="entrance"
            className="w-full"
            onValueChange={() => {
              setSelectedExamType("");
            }}
          >
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/30">
              <TabsTrigger
                value="entrance"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold"
              >
                Entrance Exam
              </TabsTrigger>
              <TabsTrigger
                value="board"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold"
              >
                Board Exam
              </TabsTrigger>
            </TabsList>

            <TabsContent value="entrance" className="space-y-2">
              <Select
                value={selectedExamType}
                onValueChange={setSelectedExamType}
              >
                <SelectTrigger
                  className={!selectedExamType ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Choose an entrance exam..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(groupedExams["Entrance Exam"] || []).map((exam) => (
                    <SelectItem key={exam.value} value={exam.value}>
                      {exam.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>

            <TabsContent value="board" className="space-y-2">
              <Select
                value={selectedExamType}
                onValueChange={setSelectedExamType}
              >
                <SelectTrigger
                  className={!selectedExamType ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Choose a board exam..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {["CBSE Board", "State Board"].map((categoryName) => (
                    <div key={categoryName}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0 z-10">
                        {categoryName}
                      </div>
                      {(groupedExams[categoryName] || []).map((exam) => (
                        <SelectItem key={exam.value} value={exam.value}>
                          {exam.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>
          </Tabs>

          {selectedExamType && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {selectedExamType}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setSelectedExamType("")}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
          {!selectedExamType && (
            <p className="text-xs text-destructive mt-1">
              Exam Type is required
            </p>
          )}
        </div>

        {/* Topic Selection (optional) */}
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Select Category Topic{" "}
            <span className="text-muted-foreground text-xs">(Optional)</span>
          </Label>
          <Select
            value={selectedTopicId}
            onValueChange={setSelectedTopicId}
            disabled={loadingTopics}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  loadingTopics ? "Loading topics..." : "Select a topic (optional)"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {topics.map((topic) => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTopicId && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {topics.find((t) => t.id === selectedTopicId)?.name}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setSelectedTopicId("")}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Post Type Tabs */}
        <Tabs value={postType} onValueChange={(val) => setPostType(val as any)}>
          <TabsList className="grid w-full grid-cols-4 bg-muted/30">
            <TabsTrigger
              value="Text"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold"
            >
              Text
            </TabsTrigger>
            <TabsTrigger
              value="Image"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold"
            >
              Image
            </TabsTrigger>
            <TabsTrigger
              value="Link"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold"
            >
              Link
            </TabsTrigger>
            <TabsTrigger
              value="Poll"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold"
            >
              Poll
            </TabsTrigger>
          </TabsList>

          {/* Text post */}
          <TabsContent value="Text" className="space-y-4">
            <div>
              <Input
                placeholder="Title (required, max 300 characters)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {title.length}/300 characters
              </p>
            </div>

            <TextEditor value={content} onChange={setContent} />

            <div className="text-xs text-muted-foreground">
              <p>Hashtags will be automatically extracted from your post content.</p>
              <p className="mt-1">
                Example: Write #engineering or #mba in your post to create tags.
              </p>
            </div>
          </TabsContent>

          {/* Image/Video post */}
          <TabsContent value="Image" className="space-y-4">
            <div>
              <Input
                placeholder="Title (required, max 300 characters)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {title.length}/300 characters
              </p>
            </div>

            <ImageUpload preview={imagePreview} onImageChange={handleImageChange} />

            <Textarea
              placeholder="Add a description (optional)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />

            <div className="text-xs text-muted-foreground">
              <p>Hashtags will be automatically extracted from your post content.</p>
              <p className="mt-1">
                Example: Write #engineering or #mba in your post to create tags.
              </p>
            </div>
          </TabsContent>

          {/* Link post */}
          <TabsContent value="Link" className="space-y-4">
            <div>
              <Input
                placeholder="Title (required, max 300 characters)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {title.length}/300 characters
              </p>
            </div>

            <Input
              placeholder="URL (required)"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />

            <Textarea
              placeholder="Add a description (optional)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />

            <div className="text-xs text-muted-foreground">
              <p>Hashtags will be automatically extracted from your post content.</p>
              <p className="mt-1">
                Example: Write #engineering or #mba in your post to create tags.
              </p>
            </div>
          </TabsContent>

          {/* Poll (coming soon) */}
          <TabsContent value="Poll" className="space-y-4">
            <div className="text-center py-8">
              <p className="text-muted-foreground">Poll feature coming soon!</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={saveDraft} disabled={isSubmitting}>
            Save Draft
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !isValidSelection}
          >
            {isSubmitting ? "Posting..." : "Post"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
