import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
}

export const InviteDialog = ({ open, onOpenChange, rideId }: InviteDialogProps) => {
  const [inviteLink, setInviteLink] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateInvite = async () => {
    try {
      setLoading(true);
      
      // Generate a unique invite token
      const inviteToken = crypto.randomUUID();
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to generate invites");
        return;
      }

      // Insert into ride_invites table
      const { error } = await supabase
        .from('ride_invites')
        .insert({
          ride_id: rideId,
          invite_token: inviteToken,
          created_by: session.user.id
        });

      if (error) throw error;

      // Generate invite link
      const link = `${window.location.origin}/auth?invite=${inviteToken}`;
      setInviteLink(link);
      toast.success("Invite link generated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate invite link");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Invite link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Someone to This Ride</DialogTitle>
          <DialogDescription>
            Generate a shareable invite link that allows non-Berkeley users to join this ride group.
            The link expires in 7 days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!inviteLink ? (
            <Button onClick={generateInvite} disabled={loading} className="w-full">
              {loading ? "Generating..." : "Generate Invite Link"}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="flex-1" />
                <Button onClick={copyToClipboard} size="icon" variant="outline">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Share this link with anyone you'd like to invite to this ride. They'll be able to sign up
                even without a @berkeley.edu email.
              </p>
              <Button 
                onClick={() => {
                  setInviteLink("");
                  onOpenChange(false);
                }} 
                variant="outline" 
                className="w-full"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
