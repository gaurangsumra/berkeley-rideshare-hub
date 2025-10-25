import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
}

export const InviteDialog = ({ open, onOpenChange, rideId }: InviteDialogProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSendInvite = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to send invites");
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-ride-invite', {
        body: { 
          rideId, 
          recipientEmail: email 
        }
      });

      if (error) throw error;

      if (data?.existingUser) {
        toast.success("User already exists - they've been granted access to this ride!");
      } else {
        toast.success("Invite sent successfully! They'll receive an email with a registration link.");
      }
      
      setSuccess(true);
      setTimeout(() => {
        setEmail("");
        setSuccess(false);
        onOpenChange(false);
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Someone to This Ride</DialogTitle>
          <DialogDescription>
            Enter their email address and we'll send them an invitation to join this ride.
            Non-Berkeley users are welcome!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!success ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                  disabled={loading}
                />
                <p className="text-sm text-muted-foreground">
                  They'll receive an email with a registration link that expires in 3 days.
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleSendInvite} 
                  disabled={loading} 
                  className="flex-1"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {loading ? "Sending..." : "Send Invite"}
                </Button>
                <Button 
                  onClick={() => onOpenChange(false)} 
                  variant="outline"
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-lg font-medium text-green-600">✓ Invite Sent!</p>
              <p className="text-sm text-muted-foreground mt-2">
                Closing automatically...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
