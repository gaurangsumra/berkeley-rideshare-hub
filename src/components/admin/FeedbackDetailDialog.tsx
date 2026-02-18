import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

interface FeedbackItem {
  id: string;
  subject: string;
  description: string;
  feedback_type: string;
  status: string;
  contact_email: string;
  admin_notes: string | null;
  created_at: string;
}

interface FeedbackDetailDialogProps {
  feedback: FeedbackItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const statusColors: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

export const FeedbackDetailDialog = ({ feedback, open, onOpenChange, onUpdated }: FeedbackDetailDialogProps) => {
  const [status, setStatus] = useState(feedback?.status || "open");
  const [notes, setNotes] = useState(feedback?.admin_notes || "");
  const [saving, setSaving] = useState(false);

  // Sync state when feedback changes
  if (feedback && status !== feedback.status && !saving) {
    setStatus(feedback.status);
    setNotes(feedback.admin_notes || "");
  }

  const handleSave = async () => {
    if (!feedback) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('feedback_submissions')
        .update({ status, admin_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', feedback.id);

      if (error) throw error;
      toast.success("Feedback updated");
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update feedback");
    } finally {
      setSaving(false);
    }
  };

  if (!feedback) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{feedback.subject}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{feedback.feedback_type}</Badge>
            <Badge className={statusColors[feedback.status] || ""}>{feedback.status}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Contact</p>
            <p className="text-sm">{feedback.contact_email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Submitted</p>
            <p className="text-sm">{format(new Date(feedback.created_at), 'MMM d, yyyy h:mm a')}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">{feedback.description}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Status</p>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Admin Notes</p>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add admin notes..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
