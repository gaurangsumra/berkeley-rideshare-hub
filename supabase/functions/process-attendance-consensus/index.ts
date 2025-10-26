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

    const { survey_id } = await req.json();

    if (!survey_id) {
      return new Response(
        JSON.stringify({ error: 'survey_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing consensus for survey ${survey_id}`);

    // Get survey details
    const { data: survey, error: surveyError } = await supabase
      .from('ride_attendance_surveys')
      .select('*')
      .eq('id', survey_id)
      .single();

    if (surveyError || !survey) {
      console.error('Survey not found:', surveyError);
      return new Response(
        JSON.stringify({ error: 'Survey not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already processed
    if (survey.consensus_processed) {
      console.log('Survey already processed');
      return new Response(
        JSON.stringify({ message: 'Already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all responses for this survey
    const { data: responses, error: responsesError } = await supabase
      .from('ride_attendance_responses')
      .select('*')
      .eq('survey_id', survey_id);

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      throw responsesError;
    }

    console.log(`Found ${responses?.length || 0} responses`);

    // Get all ride members
    const { data: allMembers, error: membersError } = await supabase
      .from('ride_members')
      .select('user_id')
      .eq('ride_id', survey.ride_id)
      .eq('status', 'joined');

    if (membersError || !allMembers) {
      console.error('Error fetching members:', membersError);
      throw membersError;
    }

    const totalRespondents = responses?.length || 0;
    
    // Calculate consensus for each member
    const completions: any[] = [];
    
    for (const member of allMembers) {
      let voteCount = 0;
      let userMarkedSelfPresent = false;

      // Count how many people marked this member as present
      for (const response of responses || []) {
        if (response.attended_user_ids.includes(member.user_id)) {
          voteCount++;
          
          // Check if this user marked themselves present
          if (response.respondent_user_id === member.user_id) {
            userMarkedSelfPresent = true;
          }
        }
      }

      // Calculate percentage
      const percentage = totalRespondents > 0 ? (voteCount / totalRespondents) * 100 : 0;
      
      // Determine if attendance is confirmed
      let confirmed = false;
      
      if (percentage > 50) {
        // Clear majority
        confirmed = true;
      } else if (percentage === 50) {
        // Tie: use self-report as tiebreaker
        confirmed = userMarkedSelfPresent;
      }

      if (confirmed) {
        completions.push({
          ride_id: survey.ride_id,
          user_id: member.user_id,
          confirmed_by_consensus: true,
          vote_count: voteCount,
          total_voters: totalRespondents,
          completed_at: new Date().toISOString()
        });
      }

      console.log(`Member ${member.user_id}: ${voteCount}/${totalRespondents} votes (${percentage.toFixed(1)}%) - ${confirmed ? 'CONFIRMED' : 'NOT CONFIRMED'}`);
    }

    // Insert ride completions
    if (completions.length > 0) {
      const { error: completionsError } = await supabase
        .from('ride_completions')
        .insert(completions);

      if (completionsError) {
        console.error('Error inserting completions:', completionsError);
        throw completionsError;
      }

      console.log(`Created ${completions.length} ride completions`);
    } else {
      console.log('No completions to create (no one confirmed as present)');
    }

    // Update survey status
    const { error: updateError } = await supabase
      .from('ride_attendance_surveys')
      .update({
        survey_status: 'completed',
        consensus_processed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', survey_id);

    if (updateError) {
      console.error('Error updating survey:', updateError);
      throw updateError;
    }

    console.log(`Survey ${survey_id} marked as completed`);

    // Check if payment has already been entered for this ride
    const { data: existingPayment } = await supabase
      .from('uber_payments')
      .select('*')
      .eq('ride_id', survey.ride_id)
      .maybeSingle();

    if (existingPayment && completions.length > 0) {
      console.log('Payment exists, sending notifications to confirmed attendees');
      
      // Get all confirmed attendees (excluding payer)
      const attendeeIds = completions
        .map(c => c.user_id)
        .filter(id => id !== existingPayment.payer_user_id);
      
      // Calculate split amount
      const totalMembers = completions.length;
      const splitAmount = existingPayment.amount / totalMembers;
      
      // Get payer name
      const { data: payerProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', existingPayment.payer_user_id)
        .single();
      
      // Send notifications to all confirmed attendees
      const notifications = attendeeIds.map(userId => ({
        user_id: userId,
        ride_id: survey.ride_id,
        type: 'payment_amount_entered',
        title: 'Payment Request',
        message: `${payerProfile?.name || 'A member'} paid $${existingPayment.amount.toFixed(2)}. Your share is $${splitAmount.toFixed(2)}. Please pay via Venmo.`,
        metadata: {
          uber_payment_id: existingPayment.id,
          amount: existingPayment.amount,
          split_amount: splitAmount,
          venmo_username: existingPayment.payer_venmo_username,
        }
      }));

      if (notifications.length > 0) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (notifError) {
          console.error('Error sending payment notifications:', notifError);
        } else {
          console.log(`Sent payment notifications to ${attendeeIds.length} members`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        completions_created: completions.length,
        total_responses: totalRespondents,
        total_members: allMembers.length,
        payment_notifications_sent: existingPayment ? completions.length - 1 : 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-attendance-consensus:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
