import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, Link2, Copy, Check } from "lucide-react";
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
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"email" | "link">("link");

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

      const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
      const res = await fetch(`${functionsUrl}/send-ride-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          rideId,
          recipientEmail: email
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Request failed with status ${res.status}`);
      }

      const data = await res.json();

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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to generate invite links");
        return;
      }

      const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
      const res = await fetch(`${functionsUrl}/send-ride-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          rideId,
          linkOnly: true
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Request failed with status ${res.status}`);
      }

      const data = await res.json();

      setInviteLink(data.inviteLink);
      toast.success("Invite link generated! Share it with anyone.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate invite link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleWhatsAppShare = () => {
    if (!inviteLink) return;
    
    const message = encodeURIComponent(
      `Hey! Join my ride on Berkeley Rides:\n${inviteLink}\n\nThis link expires in 3 days.`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Someone to This Ride</DialogTitle>
          <DialogDescription>
            Share this ride with Berkeley or non-Berkeley students
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "email" | "link")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Get Link
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Send Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4">
            {!inviteLink ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Generate a shareable link that anyone can use to join this ride. 
                  Perfect for sharing via WhatsApp, text, or social media.
                </p>
                <Button 
                  onClick={handleGenerateLink} 
                  disabled={loading}
                  className="w-full"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  {loading ? "Generating..." : "Generate Invite Link"}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Share this link:</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={inviteLink} 
                      readOnly 
                      className="flex-1 text-sm"
                    />
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={handleCopyLink}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ⏰ Expires in 3 days • 👤 Can be used once
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleWhatsAppShare}
                    variant="outline"
                    className="flex-1"
                  >
                    Share via WhatsApp
                  </Button>
                  <Button 
                    onClick={() => {
                      setInviteLink(null);
                      onOpenChange(false);
                    }}
                    variant="secondary"
                  >
                    Done
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
