import { Image, Video, MapPin, Smile, MoreHorizontal, Users, X, Plus, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deriveProfileDisplayName,
  deriveProfileHandle,
  deriveProfileInitial,
  getAvatarUrl,
  type ProfileHandleSource,
} from "@/lib/profileDisplay";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreatePostDialog = ({ open, onOpenChange }: CreatePostDialogProps) => {
  const [postContent, setPostContent] = useState("");
  const [category, setCategory] = useState("General");
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [profile, setProfile] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  const categories = ["General", "Education", "Tech", "Sports", "CollegeLife", "Exam", "Career"];

  const profileSource = profile as ProfileHandleSource | null;

  const profileHandle = useMemo(
    () => deriveProfileHandle(profileSource, "user"),
    [profileSource]
  );

  const profileDisplayName = useMemo(
    () => deriveProfileDisplayName(profileSource, "User"),
    [profileSource]
  );

  const profileInitial = useMemo(
    () => deriveProfileInitial(profileSource),
    [profileSource]
  );

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await (supabase as any)
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(data);
      };
      fetchProfile();
    }
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setVideos(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const addPollOption = () => {
    setPollOptions([...pollOptions, ""]);
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const handlePost = async () => {
    if (!postContent.trim() && images.length === 0 && videos.length === 0 && !showPoll) {
      toast({
        title: "Error",
        description: "Please add some content to post",
        variant: "destructive",
      });
      return;
    }

    if (showPoll && (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2)) {
      toast({
        title: "Error",
        description: "Please add a poll question and at least 2 options",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a post",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('posts')
        .insert({
          user_id: user.id,
          content: postContent,
          category: category,
          image_r2_key: null, // CreatePostDialog doesn't support image uploads - use CreatePostPage instead
        });

      if (error) throw error;

      toast({
        title: "Posted!",
        description: "Your post has been published successfully",
      });

      // Reset form
      setPostContent("");
      setCategory("General");
      setImages([]);
      setVideos([]);
      setLocation("");
      setShowPoll(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-center text-xl font-semibold">Create post</DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-3">
            {(() => {
              const avatarUrl = getAvatarUrl(profile, 40);
              return avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-10 w-10 rounded-full object-cover" />
              ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border-2 border-primary/10">
                <span className="text-sm font-bold text-primary">{profileInitial}</span>
              </div>
            );
            })()}
            <div>
              <p className="font-semibold text-sm">{profileDisplayName}</p>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-6 px-2 text-xs mt-1 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Text Area */}
          <Textarea
            placeholder={`What's on your mind, ${profileDisplayName || 'there'}?`}
            className="min-h-[120px] border-0 text-lg p-0 focus-visible:ring-0 resize-none"
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
          />

          {/* Image Preview */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} alt={`Upload ${i + 1}`} className="w-full h-32 object-cover rounded-lg" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Video Preview */}
          {videos.length > 0 && (
            <div className="space-y-2">
              {videos.map((vid, i) => (
                <div key={i} className="relative">
                  <video src={vid} controls className="w-full rounded-lg max-h-48" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setVideos(videos.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Location */}
          {location && (
            <div className="flex items-center gap-2 p-2 bg-secondary rounded-lg">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm">{location}</span>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-6 w-6"
                onClick={() => setLocation("")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Poll */}
          {showPoll && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Create Poll</h3>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setShowPoll(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Ask a question..."
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
              />
              {pollOptions.map((option, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Option ${i + 1}`}
                    value={option}
                    onChange={(e) => updatePollOption(i, e.target.value)}
                  />
                  {pollOptions.length > 2 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removePollOption(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addPollOption}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={handleVideoUpload}
          />

          {/* Add to post section */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Add to your post</span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 hover:bg-secondary"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <Image className="h-5 w-5 text-primary" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 hover:bg-secondary"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Video className="h-5 w-5 text-accent" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 hover:bg-secondary"
                  onClick={() => setShowPoll(!showPoll)}
                >
                  <BarChart3 className="h-5 w-5 text-primary" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 hover:bg-secondary"
                  onClick={() => {
                    const loc = prompt("Enter location:");
                    if (loc) setLocation(loc);
                  }}
                >
                  <MapPin className="h-5 w-5 text-accent" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 hover:bg-secondary"
                  onClick={() => {
                    const emoji = prompt("Enter emoji:");
                    if (emoji) setPostContent(postContent + emoji);
                  }}
                >
                  <Smile className="h-5 w-5 text-primary" />
                </Button>
              </div>
            </div>
          </div>

          {/* Post Button */}
          <Button
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground"
            onClick={handlePost}
          >
            Post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
