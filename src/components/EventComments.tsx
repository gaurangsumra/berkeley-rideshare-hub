import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
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

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    photo: string | null;
  };
}

interface EventCommentsProps {
  eventId: string;
}

export const EventComments = ({ eventId }: EventCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (expanded) {
      fetchComments();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel(`comments-${eventId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'event_comments',
            filter: `event_id=eq.${eventId}`
          },
          () => fetchComments()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [eventId, expanded]);

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('event_comments')
      .select(`
        id,
        comment,
        created_at,
        user_id,
        profiles (name, photo)
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Failed to load comments");
      return;
    }

    setComments(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("You must be logged in to comment");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('event_comments')
      .insert({
        event_id: eventId,
        user_id: user.id,
        comment: newComment.trim()
      });

    if (error) {
      toast.error("Failed to post comment");
    } else {
      setNewComment("");
      toast.success("Comment posted!");
    }
    
    setLoading(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from('event_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      toast.error("Failed to delete comment");
    } else {
      toast.success("Comment deleted");
    }
    setDeleteCommentId(null);
  };

  return (
    <div className="border-t pt-3 mt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="w-full justify-start text-muted-foreground hover:text-primary"
      >
        <MessageSquare className="w-4 h-4 mr-2" />
        {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
      </Button>

      {expanded && (
        <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
          {/* Comment form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="min-h-[60px]"
              disabled={loading}
            />
            <Button type="submit" size="icon" disabled={loading || !newComment.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>

          {/* Comments list */}
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2 text-sm group">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={comment.profiles?.photo || undefined} />
                  <AvatarFallback>
                    {comment.profiles?.name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 relative">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{comment.profiles?.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                    {currentUserId === comment.user_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteCommentId(comment.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1">{comment.comment}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteCommentId} onOpenChange={() => setDeleteCommentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCommentId && handleDeleteComment(deleteCommentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
