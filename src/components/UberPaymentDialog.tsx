import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { DollarSign, ExternalLink } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  photo: string | null;
  program: string;
}

interface UberPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  members: Profile[];
  currentUserId: string | null;
}

export const UberPaymentDialog = ({
  open,
  onOpenChange,
  rideId,
  members,
  currentUserId
}: UberPaymentDialogProps) => {
  const [willingToPay, setWillingToPay] = useState(false);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<'willing' | 'enter-amount' | 'show-split'>('willing');
  const [selectedPayer, setSelectedPayer] = useState<Profile | null>(null);

  const handleWillingSubmit = () => {
    const randomPayer = members[Math.floor(Math.random() * members.length)];
    setSelectedPayer(randomPayer);
    
    if (randomPayer.id === currentUserId) {
      setStep('enter-amount');
      toast.info("You've been selected as the payer!");
    } else {
      toast.info(`${randomPayer.name} will handle the payment`);
      onOpenChange(false);
    }
  };

  const handleAmountSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
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
      const splitAmount = parseFloat(amount) / members.length;
      
      const { error } = await supabase.from('uber_payments').insert({
        ride_id: rideId,
        payer_user_id: currentUserId!,
        amount: parseFloat(amount),
        venmo_link: `https://venmo.com`,
      });

      if (error) throw error;

      // Send email notifications to other members
      const otherMembers = members.filter(m => m.id !== currentUserId);
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', currentUserId!)
        .single();

      const { data: memberEmails } = await supabase
        .from('profiles')
        .select('email')
        .in('id', otherMembers.map(m => m.id));

      if (memberEmails && memberEmails.length > 0) {
        await supabase.functions.invoke('send-ride-notification', {
          body: {
            type: 'payment_request',
            rideId: rideId,
            recipientEmails: memberEmails.map(m => m.email),
            actorName: profile?.name || 'A member',
            amount: parseFloat(amount),
            splitAmount: parseFloat(splitAmount.toFixed(2)),
          }
        });
      }

      setStep('show-split');
    } catch (error: any) {
      toast.error("Failed to record payment");
    }
  };

  const splitAmount = amount ? (parseFloat(amount) / members.length).toFixed(2) : "0.00";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Uber Cost Split
          </DialogTitle>
          <DialogDescription>
            Coordinate payment for your shared Uber ride
          </DialogDescription>
        </DialogHeader>

        {step === 'willing' && (
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  Before booking, we need to know who can book and pay for the Uber upfront. 
                  Others will reimburse via Venmo after the ride.
                </p>
              </CardContent>
            </Card>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="willing"
                checked={willingToPay}
                onCheckedChange={(checked) => setWillingToPay(checked as boolean)}
              />
              <Label htmlFor="willing" className="cursor-pointer">
                I'm willing to book and pay for the Uber
              </Label>
            </div>

            <Button
              onClick={handleWillingSubmit}
              disabled={!willingToPay}
              className="w-full"
            >
              Submit
            </Button>
          </div>
        )}

        {step === 'enter-amount' && (
          <div className="space-y-4">
            <Card className="bg-primary/5">
              <CardContent className="p-4">
                <p className="text-sm">
                  You've been selected as the payer! After your ride, enter the total Uber fare below.
                </p>
              </CardContent>
            </Card>

            <div>
              <Label htmlFor="amount">Total Uber Fare ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="25.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button onClick={handleAmountSubmit} className="w-full">
              Calculate Split
            </Button>
          </div>
        )}

        {step === 'show-split' && (
          <div className="space-y-4">
            <Card className="bg-accent/10">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Each person owes</p>
                <p className="text-3xl font-bold text-primary">${splitAmount}</p>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <p className="text-sm font-medium">Riders need to pay:</p>
              {members.filter(m => m.id !== currentUserId).map((member) => (
                <Card key={member.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.program}</p>
                    </div>
                    <Button size="sm" asChild>
                      <a
                        href={`https://venmo.com/`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Venmo ${splitAmount}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-muted/50">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">
                  Note: Venmo links are generic. Share your Venmo username with riders separately.
                </p>
              </CardContent>
            </Card>

            <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};