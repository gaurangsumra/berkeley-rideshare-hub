import { useState, useEffect } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, DollarSign, Users } from "lucide-react";
import { VenmoUsernameDialog } from "./VenmoUsernameDialog";

interface Profile {
  id: string;
  name: string;
  photo: string | null;
  program: string;
}

interface PostRidePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  members: Profile[];
  currentUserId: string;
  travelMode: string;
  eventName: string;
}

export const PostRidePaymentDialog = ({
  open,
  onOpenChange,
  rideId,
  members,
  currentUserId,
  travelMode,
  eventName,
}: PostRidePaymentDialogProps) => {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'venmo-check' | 'enter-amount' | 'show-split'>('venmo-check');
  const [venmoUsername, setVenmoUsername] = useState<string | null>(null);
  const [showVenmoDialog, setShowVenmoDialog] = useState(false);
  const [splitAmount, setSplitAmount] = useState(0);

  useEffect(() => {
    if (open) {
      checkVenmoUsername();
    }
  }, [open, currentUserId]);

  const checkVenmoUsername = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('venmo_username')
        .eq('id', currentUserId)
        .single();

      if (error) throw error;

      if (data.venmo_username) {
        setVenmoUsername(data.venmo_username);
        setStep('enter-amount');
      } else {
        setShowVenmoDialog(true);
      }
    } catch (error: any) {
      toast.error('Failed to load your profile');
    }
  };

  const handleVenmoSubmitted = (username: string) => {
    setVenmoUsername(username);
    setShowVenmoDialog(false);
    setStep('enter-amount');
  };

  const handleSubmitAmount = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (parsedAmount > 10000) {
      toast.error("Amount cannot exceed $10,000");
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      toast.error("Please enter an amount with up to 2 decimal places");
      return;
    }

    try {
      setSubmitting(true);

      const split = parsedAmount / members.length;
      setSplitAmount(split);

      const costType = travelMode.includes('Rideshare') ? 'rideshare' : 'gas';

      // Insert payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('uber_payments')
        .insert({
          ride_id: rideId,
          payer_user_id: currentUserId,
          amount: parsedAmount,
          payer_venmo_username: venmoUsername,
          cost_type: costType,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Create payment reminders for all other members
      const otherMembers = members.filter(m => m.id !== currentUserId);
      if (otherMembers.length > 0) {
        const { error: remindersError } = await supabase
          .from('payment_reminders')
          .insert(
            otherMembers.map(m => ({
              uber_payment_id: paymentData.id,
              user_id: m.id,
            }))
          );

        if (remindersError) throw remindersError;
      }

      toast.success('Payment amount recorded!');
      setStep('show-split');
    } catch (error: any) {
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const costLabel = travelMode.includes('Rideshare') ? 'Uber/Lyft Cost' : 'Gas Cost';
  const costDescription = travelMode.includes('Rideshare') 
    ? 'Enter the total Uber/Lyft fare you paid'
    : 'Enter the estimated gas cost for this trip';

  return (
    <>
      <Dialog open={open && !showVenmoDialog} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          {step === 'enter-amount' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Enter Total {costLabel}
                </DialogTitle>
                <DialogDescription>
                  {costDescription} for the ride to {eventName}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Total Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={submitting}
                    autoFocus
                  />
                </div>

                <Button 
                  onClick={handleSubmitAmount} 
                  disabled={submitting || !amount}
                  className="w-full"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Calculate Split'
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'show-split' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Payment Split
                </DialogTitle>
                <DialogDescription>
                  The cost has been divided among all members
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="text-center p-6 bg-primary/5 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Each person owes</p>
                  <p className="text-4xl font-bold text-primary">${splitAmount.toFixed(2)}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Members who will be notified:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {members
                      .filter(m => m.id !== currentUserId)
                      .map((member) => (
                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.photo || undefined} />
                            <AvatarFallback>
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{member.name}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground text-center">
                  Members will receive notifications after attendance is confirmed
                </div>

                <Button onClick={() => onOpenChange(false)} className="w-full">
                  Done
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <VenmoUsernameDialog
        open={showVenmoDialog}
        onOpenChange={setShowVenmoDialog}
        onSubmitted={handleVenmoSubmitted}
        currentUserId={currentUserId}
      />
    </>
  );
};