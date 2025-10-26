import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting payment reminders check...');

    // Find all unconfirmed payments with reminders due
    const { data: reminders, error: remindersError } = await supabase
      .from('payment_reminders')
      .select(`
        *,
        uber_payments!inner(
          id,
          amount,
          payer_user_id,
          payer_venmo_username,
          ride_id,
          created_at,
          ride_groups!inner(
            events!inner(name, date_time)
          ),
          ride_members!inner(user_id)
        )
      `)
      .eq('payment_confirmed', false)
      .lt('reminder_count', 28); // Stop after 4 weeks (28 reminders)

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError);
      throw remindersError;
    }

    console.log(`Found ${reminders?.length || 0} potential reminders`);

    let remindersSent = 0;

    for (const reminder of reminders || []) {
      // Check if 24 hours passed since last reminder
      const lastReminderDate = new Date(reminder.last_reminder_sent);
      const now = new Date();
      const hoursSince = (now.getTime() - lastReminderDate.getTime()) / (1000 * 60 * 60);

      if (hoursSince >= 24) {
        const payment = reminder.uber_payments;
        
        // Calculate split amount
        const totalMembers = payment.ride_members.length;
        const splitAmount = payment.amount / totalMembers;

        // Get payer name
        const { data: payerProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', payment.payer_user_id)
          .single();

        // Send notification
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: reminder.user_id,
            ride_id: payment.ride_id,
            type: 'payment_reminder',
            title: 'Payment Reminder',
            message: `Reminder: You owe $${splitAmount.toFixed(2)} to ${payerProfile?.name || 'a member'} for ${payment.ride_groups.events.name}`,
            metadata: {
              uber_payment_id: payment.id,
              reminder_count: reminder.reminder_count + 1,
              split_amount: splitAmount,
              venmo_username: payment.payer_venmo_username,
            }
          });

        if (notifError) {
          console.error('Error sending notification:', notifError);
          continue;
        }

        // Update reminder record
        const { error: updateError } = await supabase
          .from('payment_reminders')
          .update({
            last_reminder_sent: now.toISOString(),
            reminder_count: reminder.reminder_count + 1,
          })
          .eq('id', reminder.id);

        if (updateError) {
          console.error('Error updating reminder:', updateError);
          continue;
        }

        remindersSent++;
        console.log(`Sent reminder ${reminder.reminder_count + 1}/28 to user ${reminder.user_id}`);
      }
    }

    console.log(`Payment reminders process completed. Sent ${remindersSent} reminders.`);

    return new Response(
      JSON.stringify({ 
        success: true,
        reminders_sent: remindersSent,
        total_checked: reminders?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-payment-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});