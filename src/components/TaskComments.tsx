import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Send, MessageSquare, Trash2, Edit2, X, Check } from "lucide-react";
import { useSoundEffects } from "@/hooks/useSoundEffects";

interface Comment {
  id: string;
  comment_text: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface TaskCommentsProps {
  jobId: string;
}

export function TaskComments({ jobId }: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const { playSound } = useSoundEffects();

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from("job_comments")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch profile data separately
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);

      const profilesMap = new Map(
        (profilesData || []).map(p => [p.user_id, p])
      );

      const commentsWithProfiles = (data || []).map(comment => ({
        ...comment,
        profiles: profilesMap.get(comment.user_id) || {
          full_name: "Unknown User",
          avatar_url: null
        }
      }));

      setComments(commentsWithProfiles);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Error loading comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || newComment.length > 2000) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("job_comments").insert({
        job_id: jobId,
        user_id: currentUserId,
        comment_text: newComment.trim(),
      });

      if (error) throw error;
      
      setNewComment("");
      playSound("success");
      toast.success("Comment added");
      await loadComments();
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
      playSound("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!editText.trim() || editText.length > 2000) return;

    try {
      const { error } = await supabase
        .from("job_comments")
        .update({ comment_text: editText.trim() })
        .eq("id", commentId);

      if (error) throw error;
      
      setEditingId(null);
      setEditText("");
      playSound("success");
      toast.success("Comment updated");
      await loadComments();
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Failed to update comment");
      playSound("error");
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("job_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
      
      playSound("success");
      toast.success("Comment deleted");
      await loadComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
      playSound("error");
    }
  };

  const canEdit = (comment: Comment) => {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    return (
      comment.user_id === currentUserId &&
      new Date(comment.created_at) > fifteenMinutesAgo
    );
  };

  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    initUser();
    loadComments();

    const channel = supabase
      .channel(`job-comments-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_comments",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playSound("click");
          }
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  if (loading) {
    return (
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading comments...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Comments
          {comments.length > 0 && (
            <Badge variant="secondary">{comments.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No comments yet. Start the conversation!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="flex gap-3 p-3 rounded-lg bg-muted/50 animate-slide-in-right"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={comment.profiles.avatar_url || undefined} />
                  <AvatarFallback>
                    {comment.profiles.full_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">
                      {comment.profiles.full_name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                      {canEdit(comment) && editingId !== comment.id && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditText(comment.comment_text);
                            }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive"
                            onClick={() => handleDelete(comment.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-20"
                        maxLength={2000}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleEdit(comment.id)}
                          disabled={!editText.trim()}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(null);
                            setEditText("");
                          }}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {comment.comment_text}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={commentsEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-20 resize-none"
            maxLength={2000}
            disabled={submitting}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {newComment.length}/2000
            </span>
            <Button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
