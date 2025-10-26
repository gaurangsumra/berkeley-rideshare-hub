import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface PaymentConfirmationCardProps {
  payment: {
    id: string;
    amount: number;
    payer_user_id: string;
    payer_venmo_username: string | null;
    cost_type: 'rideshare' | 'gas';
    ride_id: string;
  };
  splitAmount: number;
  rideInfo: {
    eventName: string;
    eventDate: string;
    payerName: string;
  };
  currentUserId: string;
  onConfirmed: () => void;
}

export const PaymentConfirmationCard = ({
  payment,
  splitAmount,
  rideInfo,
  currentUserId,
  onConfirmed,
}: PaymentConfirmationCardProps) => {
  const [confirming, setConfirming] = useState(false);

  const handleConfirmPayment = async () => {
    try {
      setConfirming(true);

      // Insert confirmation
      const { error: confirmError } = await supabase
        .from('payment_confirmations')
        .insert({
          uber_payment_id: payment.id,
          user_id: currentUserId,
        });

      if (confirmError) throw confirmError;

      // Update reminder status
      const { error: reminderError } = await supabase
        .from('payment_reminders')
        .update({ payment_confirmed: true })
        .eq('uber_payment_id', payment.id)
        .eq('user_id', currentUserId);

      if (reminderError) throw reminderError;

      // Get current user name for notification
      const { data: userData } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', currentUserId)
        .single();

      // Notify payer
      await supabase.from('notifications').insert({
        user_id: payment.payer_user_id,
        ride_id: payment.ride_id,
        type: 'payment_confirmed',
        title: 'Payment Confirmed',
        message: `${userData?.name || 'A member'} confirmed payment of $${splitAmount.toFixed(2)}`,
        metadata: {
          uber_payment_id: payment.id,
          user_id: currentUserId,
        }
      });

      toast.success('Payment confirmed! Thank you.');
      onConfirmed();
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      toast.error(error.message || 'Failed to confirm payment');
    } finally {
      setConfirming(false);
    }
  };

  const venmoDeepLink = payment.payer_venmo_username
    ? `https://venmo.com/${payment.payer_venmo_username}?txn=pay&amount=${splitAmount.toFixed(2)}&note=${encodeURIComponent(`Berkeley Rides - ${rideInfo.eventName}`)}`
    : null;

  return (
    <Card className="border-yellow-500/50 bg-yellow-50/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-yellow-600" />
            Payment Needed
          </span>
          <Badge variant="outline">
            {payment.cost_type === 'rideshare' ? 'Uber/Lyft' : 'Gas Cost'}
          </Badge>
        </CardTitle>
        <CardDescription>
          {rideInfo.eventName} • {format(new Date(rideInfo.eventDate), 'MMM d, yyyy')}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="text-center mb-4 p-4 bg-primary/5 rounded-lg">
          <p className="text-sm text-muted-foreground">You owe</p>
          <p className="text-4xl font-bold text-primary">${splitAmount.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-1">to {rideInfo.payerName}</p>
        </div>
        
        {venmoDeepLink && (
          <Button variant="default" className="w-full mb-2" asChild>
            <a 
              href={venmoDeepLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              Pay ${splitAmount.toFixed(2)} via Venmo
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
        
        <Button 
          onClick={handleConfirmPayment} 
          variant={venmoDeepLink ? "outline" : "default"}
          className="w-full"
          disabled={confirming}
        >
          {confirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Confirming...
            </>
          ) : (
            "I've Paid"
          )}
        </Button>
        
        {!venmoDeepLink && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Contact {rideInfo.payerName} for payment details
          </p>
        )}
      </CardContent>
    </Card>
  );
};