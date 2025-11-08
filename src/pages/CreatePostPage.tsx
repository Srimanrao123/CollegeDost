import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TextEditor } from "@/components/posts/TextEditor";
import { TagSelector } from "@/components/posts/TagSelector";
import { ImageUpload } from "@/components/posts/ImageUpload";
import { ProgressBar } from "@/components/posts/ProgressBar";
import { X } from "lucide-react";
import examsData from "@/utils/exams.json";
import { Badge } from "@/components/ui/badge";

interface Topic {
  id: string;
  name: string;
  description?: string;
}

const AVAILABLE_TAGS = [
  "Engineering", "Medical", "Commerce", "Science", "Law", 
  "MBA", "CA", "NEET", "JEE", "UPSC", "SSC", "Banking",
  "GATE", "CAT", "CLAT", "NDA", "Railway", "Teaching"
];

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [selectedExamType, setSelectedExamType] = useState<string>("");
  const isValidSelection = !!selectedExamType; // Only exam type is required now

  // Organize all exams with categories
  const allExamsWithCategories = useMemo(() => {
    const exams: Array<{ value: string; label: string; category: string }> = [];
    
    // Add CBSE exams
    (examsData.board_exams?.CBSE || []).forEach(exam => {
      exams.push({ value: exam, label: exam, category: 'CBSE Board' });
    });
    
    // Add State Board exams
    (examsData.board_exams?.StateBoard || []).forEach(exam => {
      exams.push({ value: exam, label: exam, category: 'State Board' });
    });
    
    // Add Entrance exams
    (examsData.entrance_exams || []).forEach(exam => {
      exams.push({ value: exam, label: exam, category: 'Entrance Exam' });
    });
    
    return exams;
  }, []);

  // Group exams by category for display
  const groupedExams = useMemo(() => {
    const groups: Record<string, typeof allExamsWithCategories> = {};
    allExamsWithCategories.forEach(exam => {
      if (!groups[exam.category]) {
        groups[exam.category] = [];
      }
      groups[exam.category].push(exam);
    });
    return groups;
  }, [allExamsWithCategories]);

  // Extract hashtags from text content
  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#\w+/g;
    const matches = text.match(hashtagRegex);
    if (!matches) return [];
    // Remove the # symbol and convert to lowercase, remove duplicates
    return [...new Set(matches.map(tag => tag.substring(1).toLowerCase()))];
  };

  // Fetch topics from database
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('topics')
          .select('id, name, description')
          .order('name', { ascending: true });

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

  // Load draft from localStorage
  useEffect(() => {
    const draft = localStorage.getItem("post_draft");
    if (draft) {
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
    }
  }, []);

  // Extract hashtags from content when it changes (only update if new tags are found)
  useEffect(() => {
    const extractedTags = extractHashtags(content + " " + title);
    // Only update if there are new extracted tags that aren't already in selectedTags
    const newTags = extractedTags.filter(tag => !selectedTags.includes(tag));
    if (newTags.length > 0) {
      setSelectedTags(prev => [...new Set([...prev, ...extractedTags])]);
    }
  }, [content, title]); // Removed selectedTags from dependencies to avoid infinite loop

  // Save draft to localStorage
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

  // Handle image upload
  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview("");
    }
  };

  // Upload image to Supabase storage
  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;

    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Ensure correct content type and allow overwrite to avoid duplicate errors
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, imageFile, {
          contentType: imageFile.type || 'application/octet-stream',
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return null;
      }

      const { data: publicData } = supabase.storage
        .from('post-images')
        .getPublicUrl(uploadData?.path || filePath);

      const publicUrl = publicData?.publicUrl || null;
      if (!publicUrl) {
        console.error('Failed to get public URL for uploaded image.');
      }
      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  // Handle post submission
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

    // NEW: Validate that exam type is selected (required)
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
      let imageUrl = null;
      
      // Upload image if present
      if (imageFile && (postType === "Image" || postType === "Video")) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          throw new Error("Failed to upload image");
        }
      }

      // Determine category from selected exam type
      let category: "Entrance Exam" | "Board Exam" = "Entrance Exam";
      if (selectedExamType) {
        const examInfo = allExamsWithCategories.find(e => e.value === selectedExamType);
        if (examInfo?.category === 'CBSE Board' || examInfo?.category === 'State Board') {
          category = "Board Exam";
        }
      }

      // Extract hashtags from content and title
      const extractedHashtags = extractHashtags(content + " " + title);
      
      // Prepare post data
      const postData: any = {
        user_id: user.id,
        title: title.trim(),
        content: content.trim() || null,
        image_url: imageUrl,
        link_url: postType === "Link" ? linkUrl.trim() : null,
        topic_id: selectedTopicId || null, // Now optional
        category,
        post_type: postType,
        exam_type: selectedExamType, // Required
        likes_count: 0,
        comments_count: 0,
      };

      // Insert post into database with type casting
      const { data: newPost, error: postError } = await (supabase as any)
        .from('posts')
        .insert([postData])
        .select()
        .single();

      if (postError) {
        console.error("Post insert error:", postError);
        throw postError;
      }

      // Process tags if any exist
      if (extractedHashtags.length > 0 && newPost) {
        await processPostTags(newPost.id, extractedHashtags);
      }

      // Clear draft
      localStorage.removeItem("post_draft");

      // Dispatch custom event for tag updates
      window.dispatchEvent(new CustomEvent('tagsUpdated', { 
        detail: { tags: extractedHashtags } 
      }));

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

  // Process tags: upsert into tags table and link in post_tags
  const processPostTags = async (postId: string, hashtags: string[]) => {
    if (!hashtags || hashtags.length === 0) return;
    
    try {
      // Filter out empty or invalid tag names
      const validTags = hashtags
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0 && tag.length <= 50); // Max tag length reasonable limit

      if (validTags.length === 0) return;

      for (const tagName of validTags) {
        try {
          // Upsert tag (insert or get existing)
          const { data: tag, error: tagError } = await (supabase as any)
            .from('tags')
            .upsert(
              { name: tagName },
              { 
                onConflict: 'name',
                ignoreDuplicates: false 
              }
            )
            .select()
            .single();

          let tagId: string | null = null;

          if (tagError) {
            console.error('Error upserting tag:', tagError);
            // Try to fetch existing tag
            const { data: existingTag, error: fetchError } = await (supabase as any)
              .from('tags')
              .select('id')
              .eq('name', tagName)
              .single();
            
            if (fetchError) {
              console.error('Error fetching existing tag:', fetchError);
              continue; // Skip this tag
            }
            
            if (existingTag) {
              tagId = existingTag.id;
            } else {
              continue; // Tag doesn't exist and couldn't be created
            }
          } else if (tag) {
            tagId = tag.id;
          }

          // Link tag to post
          if (tagId) {
            const { error: linkError } = await (supabase as any)
              .from('post_tags')
              .insert({ post_id: postId, tag_id: tagId })
              .select();

            if (linkError) {
              // Check if it's just a duplicate error (unique constraint violation)
              if (linkError.code === '23505' || linkError.message?.includes('duplicate')) {
                // Tag already linked to post, that's fine
                console.log(`Tag ${tagName} already linked to post`);
              } else {
                console.error('Error linking tag to post:', linkError);
                // Continue processing other tags even if one fails
              }
            }
          }
        } catch (tagProcessingError) {
          // Catch individual tag processing errors to continue with other tags
          console.error(`Error processing tag ${tagName}:`, tagProcessingError);
          continue;
        }
      }
    } catch (error) {
      console.error('Error processing tags:', error);
      // Don't throw - tag processing errors shouldn't fail the entire post creation
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Create Post</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <Card className="p-6 space-y-6">
        {/* Exam Type Selection - REQUIRED with Tabs */}
        <div>
          <Label className="text-sm font-medium mb-3 block">
            Select Exam Type <span className="text-destructive">*</span>
          </Label>
          
          {/* Board Exam & Entrance Exam Tabs */}
          <Tabs 
            defaultValue="entrance" 
            className="w-full"
            onValueChange={(value) => {
              // Clear selection when switching tabs
              setSelectedExamType("");
            }}
          >
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/30">
              <TabsTrigger value="entrance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">Entrance Exam</TabsTrigger>
              <TabsTrigger value="board" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">Board Exam</TabsTrigger>
            </TabsList>
            
            <TabsContent value="entrance" className="space-y-2">
              <Select value={selectedExamType} onValueChange={setSelectedExamType}>
                <SelectTrigger className={!selectedExamType ? "border-destructive" : ""}>
                  <SelectValue placeholder="Choose an entrance exam..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(groupedExams['Entrance Exam'] || []).map((exam) => (
                    <SelectItem key={exam.value} value={exam.value}>
                      {exam.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>
            
            <TabsContent value="board" className="space-y-2">
              <Select value={selectedExamType} onValueChange={setSelectedExamType}>
                <SelectTrigger className={!selectedExamType ? "border-destructive" : ""}>
                  <SelectValue placeholder="Choose a board exam..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {['CBSE Board', 'State Board'].map((categoryName) => (
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

        {/* Topic Selection - OPTIONAL */}
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Select Category Topic <span className="text-muted-foreground text-xs">(Optional)</span>
          </Label>
          <Select 
            value={selectedTopicId} 
            onValueChange={setSelectedTopicId}
            disabled={loadingTopics}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingTopics ? "Loading topics..." : "Select a topic (optional)"} />
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
                {topics.find(t => t.id === selectedTopicId)?.name}
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
            <TabsTrigger value="Text" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">Text</TabsTrigger>
            <TabsTrigger value="Image" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">Image</TabsTrigger>
            <TabsTrigger value="Link" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">Link</TabsTrigger>
            <TabsTrigger value="Poll" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">Poll</TabsTrigger>
          </TabsList>

          {/* Text Post */}
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
              <p className="mt-1">Example: Write #engineering or #mba in your post to create tags.</p>
            </div>
          </TabsContent>

          {/* Image/Video Post */}
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

            <ImageUpload
              preview={imagePreview}
              onImageChange={handleImageChange}
            />

            <Textarea
              placeholder="Add a description (optional)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />

            <div className="text-xs text-muted-foreground">
              <p>Hashtags will be automatically extracted from your post content.</p>
              <p className="mt-1">Example: Write #engineering or #mba in your post to create tags.</p>
            </div>
          </TabsContent>

          {/* Link Post */}
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
              <p className="mt-1">Example: Write #engineering or #mba in your post to create tags.</p>
            </div>
          </TabsContent>

          {/* Poll Post */}
          <TabsContent value="Poll" className="space-y-4">
            <div className="text-center py-8">
              <p className="text-muted-foreground">Poll feature coming soon!</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={saveDraft}
            disabled={isSubmitting}
          >
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
