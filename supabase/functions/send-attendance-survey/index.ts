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

    // Step 1: Find rides that ended 15+ minutes ago and don't have a survey yet
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    const { data: ridesNeedingSurveys, error: ridesError } = await supabase
      .from('ride_groups')
      .select(`
        id,
        event_id,
        events!inner(date_time, name)
      `)
      .lte('events.date_time', fifteenMinutesAgo);

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

      // Send email notifications
      const { data: memberEmails } = await supabase
        .from('ride_members')
        .select('profiles!inner(email)')
        .eq('ride_id', ride.id)
        .eq('status', 'joined');

      if (memberEmails && memberEmails.length > 0) {
        const emails = memberEmails
          .map(m => (m.profiles as any)?.email)
          .filter(Boolean);

        const { error: emailError } = await supabase.functions.invoke('send-ride-notification', {
          body: {
            type: 'attendance_survey',
            rideId: ride.id,
            recipientEmails: emails,
            eventName: eventInfo.name,
            surveyDeadline: deadline.toISOString()
          }
        });

        if (emailError) {
          console.error(`Error sending emails for ride ${ride.id}:`, emailError);
        } else {
          console.log(`Sent ${emails.length} email notifications for ride ${ride.id}`);
        }
      }
    }

    // Step 3: Send 24-hour reminders for non-responders
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: surveysNeedingReminders, error: reminderError } = await supabase
      .from('ride_attendance_surveys')
      .select('id, ride_id, total_members, responses_received, events!inner(name)')
      .eq('survey_status', 'in_progress')
      .lte('survey_sent_at', twentyFourHoursAgo)
      .is('reminder_sent_at', null);

    if (!reminderError && surveysNeedingReminders && surveysNeedingReminders.length > 0) {
      console.log(`Found ${surveysNeedingReminders.length} surveys needing reminders`);

      for (const survey of surveysNeedingReminders) {
        const eventInfo = survey.events as any;

        // Get members who haven't responded
        const { data: allMembers } = await supabase
          .from('ride_members')
          .select('user_id, profiles!inner(email)')
          .eq('ride_id', survey.ride_id)
          .eq('status', 'joined');

        const { data: responses } = await supabase
          .from('ride_attendance_responses')
          .select('respondent_user_id')
          .eq('survey_id', survey.id);

        const respondedIds = new Set(responses?.map(r => r.respondent_user_id) || []);
        const nonResponders = allMembers?.filter(m => !respondedIds.has(m.user_id)) || [];

        if (nonResponders.length > 0) {
          // Create reminder notifications
          const reminders = nonResponders.map(member => ({
            user_id: member.user_id,
            ride_id: survey.ride_id,
            type: 'attendance_survey_reminder',
            title: '⏰ Reminder: Rate your ride companions',
            message: `Please confirm who showed up for ${eventInfo.name}. Your response is needed!`,
            metadata: {
              survey_id: survey.id,
              ride_id: survey.ride_id
            }
          }));

          await supabase.from('notifications').insert(reminders);

          // Send reminder emails
          const emails = nonResponders
            .map(m => (m.profiles as any)?.email)
            .filter(Boolean);

          if (emails.length > 0) {
            await supabase.functions.invoke('send-ride-notification', {
              body: {
                type: 'attendance_survey_reminder',
                rideId: survey.ride_id,
                recipientEmails: emails,
                eventName: eventInfo.name
              }
            });
          }

          // Mark reminder as sent
          await supabase
            .from('ride_attendance_surveys')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', survey.id);

          console.log(`Sent reminders to ${nonResponders.length} non-responders for survey ${survey.id}`);
        }
      }
    }

    // Step 4: Check for expired surveys and process them
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
        remindersSent: surveysNeedingReminders?.length || 0,
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
