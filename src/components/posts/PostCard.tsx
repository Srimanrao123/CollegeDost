import { ThumbsUp, ThumbsDown, MessageSquare, Share2, Eye, MoreVertical, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLikes } from "@/hooks/useLikes";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { removeTagsFromContent } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PostCardProps {
  id: string;
  authorId: string;
  author: string;
  location?: string;
  timeAgo: string;
  title: string;
  content?: string;
  category?: string;
  examType?: string;
  image?: string | boolean;
  likes?: number;
  dislikes?: number;
  comments?: number;
  views?: number;
  tags?: string[];
}

export const PostCard = ({
  id,
  authorId,
  author,
  location,
  timeAgo,
  title,
  content,
  image,
  category,
  examType,
  comments = 0,
  views = 0,
  tags = [],
  avatarUrl,
}: PostCardProps & { avatarUrl?: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasLiked, likesCount, toggleLike } = useLikes(id, user?.id);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  const isOwner = user?.id === authorId;

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/auth');
      return;
    }
    toggleLike();
  };

  const handlePostClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      e.stopPropagation();
      navigate('/auth');
      return;
    }
  };

  const handleShare = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const shareUrl = `${window.location.origin}/post/${id}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      toast({
        title: "Link copied",
        description: "Post link copied to your clipboard",
      });
    } catch (error: any) {
      console.error("Share error", error);
      toast({
        title: "Copy failed",
        description: "We couldn't copy the link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await (supabase as any)
        .from('posts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post deleted successfully",
      });
      
      setShowDeleteDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete post",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Link to={`/profile/${authorId}`}>
            <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 ring-primary transition-all">
              <AvatarImage src={avatarUrl} alt={author} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {author.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{author}</span>
              <span className="text-xs text-muted-foreground">• {timeAgo}</span>
            </div>
            {location && (
              <p className="text-xs text-muted-foreground">{location}</p>
            )}
          </div>
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Link 
          to={`/post/${id}`} 
          className="block space-y-3"
          onClick={handlePostClick}
        >
          <h2 className="font-bold text-base md:text-lg hover:text-primary transition-colors leading-tight">
            {title}
          </h2>
          {examType && (
            <span className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
              {examType}
            </span>
          )}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.slice(0, 5).map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-xs bg-secondary rounded-full hover:bg-secondary/80 cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Navigate to All page and filter by tag
                    navigate('/all');
                    // Dispatch event after a short delay to ensure navigation happens first
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('tagsSelected', { 
                        detail: { tags: [tag], mode: 'any' } 
                      }));
                    }, 100);
                  }}
                >
                  #{tag}
                </span>
              ))}
              {tags.length > 5 && (
                <span className="px-2 py-0.5 text-xs text-muted-foreground">
                  +{tags.length - 5} more
                </span>
              )}
            </div>
          )}
          {content && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {removeTagsFromContent(content, tags)}
            </p>
          )}
          {typeof image === "string" && image && (
            <div className="relative w-full bg-muted">
              <img
                src={image}
                alt="Post image"
                className="max-w-full h-auto"
                loading="eager"
                decoding="async"
              />
            </div>
          )}
        </Link>

          <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 md:gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1.5  focus-visible:ring-0"
                onClick={handleLike}
              >
                <ThumbsUp className={`h-4 w-4 ${hasLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium min-w-[1.5rem] text-left">{likesCount}</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1.5 focus-visible:ring-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!user) {
                    navigate('/auth');
                    return;
                  }
                  navigate(`/post/${id}`);
                }}
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium min-w-[1.5rem] text-left">{comments}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 hover:bg-transparent focus-visible:ring-0"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span className="font-medium">{views || 0}</span>
            </div>
          </div>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
