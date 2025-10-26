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

    console.log('Starting attendance survey check...');

    // Step 1: Find rides that ended 24+ hours ago and don't have a survey yet
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: ridesNeedingSurveys, error: ridesError } = await supabase
      .from('ride_groups')
      .select(`
        id,
        event_id,
        events!inner(date_time, name)
      `)
      .lte('events.date_time', twentyFourHoursAgo);

    if (ridesError) {
      console.error('Error fetching rides:', ridesError);
      throw ridesError;
    }

    console.log(`Found ${ridesNeedingSurveys?.length || 0} rides needing surveys`);

    // Step 2: Create surveys for these rides
    for (const ride of ridesNeedingSurveys || []) {
      // Check if survey already exists
      const { data: existingSurvey } = await supabase
        .from('ride_attendance_surveys')
        .select('id')
        .eq('ride_id', ride.id)
        .maybeSingle();

      if (existingSurvey) {
        console.log(`Survey already exists for ride ${ride.id}`);
        continue;
      }

      const eventInfo = ride.events as any;
      // Get member count
      const { count: memberCount, error: countError } = await supabase
        .from('ride_members')
        .select('*', { count: 'exact', head: true })
        .eq('ride_id', ride.id)
        .eq('status', 'joined');

      if (countError || !memberCount) {
        console.error(`Error counting members for ride ${ride.id}:`, countError);
        continue;
      }

      // Calculate deadline (event time + 48 hours)
      const eventTime = new Date(eventInfo.date_time);
      const deadline = new Date(eventTime.getTime() + 48 * 60 * 60 * 1000);

      // Create survey
      const { data: survey, error: surveyError } = await supabase
        .from('ride_attendance_surveys')
        .insert({
          ride_id: ride.id,
          survey_status: 'in_progress',
          survey_sent_at: new Date().toISOString(),
          survey_deadline: deadline.toISOString(),
          total_members: memberCount,
          responses_received: 0
        })
        .select()
        .single();

      if (surveyError) {
        console.error(`Error creating survey for ride ${ride.id}:`, surveyError);
        continue;
      }

      console.log(`Created survey ${survey.id} for ride ${ride.id}`);

      // Get all ride members to notify
      const { data: members, error: membersError } = await supabase
        .from('ride_members')
        .select('user_id')
        .eq('ride_id', ride.id)
        .eq('status', 'joined');

      if (membersError || !members) {
        console.error(`Error fetching members for ride ${ride.id}:`, membersError);
        continue;
      }

      // Create notifications for all members
      const notifications = members.map(member => ({
        user_id: member.user_id,
        ride_id: ride.id,
        type: 'attendance_survey',
        title: 'Rate your ride companions',
        message: `Your ride to ${eventInfo.name} has ended. Please confirm who showed up.`,
        metadata: {
          survey_id: survey.id,
          ride_id: ride.id,
          deadline: deadline.toISOString()
        }
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error(`Error creating notifications for ride ${ride.id}:`, notifError);
      } else {
        console.log(`Sent ${notifications.length} notifications for ride ${ride.id}`);
      }
    }

    // Step 3: Check for expired surveys and process them
    const now = new Date().toISOString();
    const { data: expiredSurveys, error: expiredError } = await supabase
      .from('ride_attendance_surveys')
      .select('id, ride_id')
      .eq('survey_status', 'in_progress')
      .lt('survey_deadline', now)
      .eq('consensus_processed', false);

    if (expiredError) {
      console.error('Error fetching expired surveys:', expiredError);
    } else if (expiredSurveys && expiredSurveys.length > 0) {
      console.log(`Found ${expiredSurveys.length} expired surveys to process`);
      
      for (const survey of expiredSurveys) {
        // Mark as expired
        await supabase
          .from('ride_attendance_surveys')
          .update({ survey_status: 'expired' })
          .eq('id', survey.id);

        // Trigger consensus processing
        const { error: invokeError } = await supabase.functions.invoke('process-attendance-consensus', {
          body: { survey_id: survey.id }
        });

        if (invokeError) {
          console.error(`Error invoking consensus for survey ${survey.id}:`, invokeError);
        } else {
          console.log(`Triggered consensus processing for expired survey ${survey.id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        surveysCreated: ridesNeedingSurveys?.length || 0,
        surveysExpired: expiredSurveys?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-attendance-survey:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
