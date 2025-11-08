import { useState } from "react";
import { Comment } from "@/hooks/useComments";
import { useAuth } from "@/hooks/useAuth";
import { useCommentLikes } from "@/hooks/useCommentLikes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageSquare, Share2, MoreVertical, Edit, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
import { deriveProfileHandle, deriveProfileInitial, type ProfileHandleSource } from "@/lib/profileDisplay";

interface CommentItemProps {
  comment: Comment;
  level?: number;
  onReply: (content: string, parentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
}

export function CommentItem({ comment, level = 0, onReply, onEdit, onDelete }: CommentItemProps) {
  const { user } = useAuth();
  const { hasLiked, likesCount, toggleLike } = useCommentLikes(comment.id, user?.id);
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [editContent, setEditContent] = useState(comment.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isOwner = user?.id === comment.user_id;
  const maxLevel = 5; // Maximum nesting level

  const handleReply = () => {
    if (replyContent.trim()) {
      onReply(replyContent, comment.id);
      setReplyContent("");
      setIsReplying(false);
    }
  };

  const handleEdit = () => {
    if (editContent.trim() && editContent !== comment.content) {
      onEdit(comment.id, editContent);
      setIsEditing(false);
    }
  };

  const handleDelete = () => {
    onDelete(comment.id);
    setShowDeleteDialog(false);
  };

  return (
    <div className={`${level > 0 ? 'ml-8 border-l-2 border-border pl-4' : ''}`}>
      <div className="py-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={comment.profiles?.avatar_url} />
            <AvatarFallback>
              {deriveProfileInitial(comment.profiles as ProfileHandleSource | null)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">
                {deriveProfileHandle(comment.profiles as ProfileHandleSource | null, 'anonymous')}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-2 mb-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[60px]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEdit}>
                    Save
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(comment.content);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm mb-2 break-words">{comment.content}</p>
            )}

            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 gap-1 hover:bg-transparent"
                onClick={toggleLike}
              >
                <Heart
                  className={`h-4 w-4 ${hasLiked ? 'fill-[#ff4500] text-[#ff4500]' : 'text-muted-foreground'}`}
                />
                <span className="text-xs font-medium">{likesCount}</span>
              </Button>

              {level < maxLevel && user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 gap-1 hover:bg-transparent text-muted-foreground"
                  onClick={() => setIsReplying(!isReplying)}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-xs font-medium">Reply</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 gap-1 hover:bg-transparent text-muted-foreground"
              >
                <Share2 className="h-4 w-4" />
                <span className="text-xs font-medium">Share</span>
              </Button>
            </div>

            {isReplying && (
              <div className="mt-3 space-y-2">
                <Textarea
                  placeholder="Write a reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="min-h-[60px]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleReply} disabled={!replyContent.trim()}>
                    Reply
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setIsReplying(false);
                      setReplyContent("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nested Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                level={level + 1}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
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
    </div>
  );
}
