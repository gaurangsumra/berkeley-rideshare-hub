import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, DollarSign } from "lucide-react";

interface VenmoUsernameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (username: string) => void;
  currentUserId: string;
}

export const VenmoUsernameDialog = ({
  open,
  onOpenChange,
  onSubmitted,
  currentUserId,
}: VenmoUsernameDialogProps) => {
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate username
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      toast.error("Please enter your Venmo username");
      return;
    }

    // Validate format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      toast.error("Username can only contain letters, numbers, hyphens, and underscores");
      return;
    }

    try {
      setSubmitting(true);

      // Update profile with Venmo username
      const { error } = await supabase
        .from('profiles')
        .update({ venmo_username: trimmedUsername })
        .eq('id', currentUserId);

      if (error) throw error;

      toast.success("Venmo username saved!");
      onSubmitted(trimmedUsername);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save Venmo username');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Add Venmo Username
          </DialogTitle>
          <DialogDescription>
            We need your Venmo username so other riders can easily pay you for ride costs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="venmo-username">Venmo Username</Label>
            <Input
              id="venmo-username"
              placeholder="your-venmo-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Your Venmo username (without the @)
            </p>
          </div>

          <Button type="submit" disabled={submitting || !username.trim()} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};