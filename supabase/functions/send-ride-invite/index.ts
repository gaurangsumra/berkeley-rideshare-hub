import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  rideId: string;
  recipientEmail: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { rideId, recipientEmail }: InviteRequest = await req.json();

    console.log('Processing ride invite:', { rideId, recipientEmail });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error('Invalid email format');
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, is_invited_user, name')
      .eq('email', recipientEmail)
      .single();

    if (existingProfile) {
      const { data: rideData } = await supabase
        .from('ride_groups')
        .select('event_id')
        .eq('id', rideId)
        .single();

      if (rideData) {
        await supabase
          .from('event_access')
          .insert({
            user_id: existingProfile.id,
            event_id: rideData.event_id,
            granted_via_ride_id: rideId
          });

        console.log('Granted event access to existing user');
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'User already exists - access granted',
            existingUser: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    const inviterName = inviterProfile?.name || 'A Berkeley student';

    const { data: rideDetails } = await supabase
      .from('ride_groups')
      .select(`
        id,
        departure_time,
        travel_mode,
        meeting_point,
        events (
          name,
          date_time,
          destination,
          city
        )
      `)
      .eq('id', rideId)
      .single();

    if (!rideDetails) {
      throw new Error('Ride not found');
    }

    const event = rideDetails.events as any;

    const inviteToken = crypto.randomUUID();

    const { error: insertError } = await supabase
      .from('ride_invites')
      .insert({
        ride_id: rideId,
        invite_token: inviteToken,
        created_by: user.id,
        invited_email: recipientEmail,
        inviter_name: inviterName,
        expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    const registrationLink = `${Deno.env.get('SUPABASE_URL')!.replace('.supabase.co', '.lovable.app')}/auth?invite=${inviteToken}`;

    const eventDate = new Date(event.date_time).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    const emailResponse = await resend.emails.send({
      from: "Berkeley Rides <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `Join ${inviterName}'s ride to ${event.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #8B5CF6; 
              color: white; 
              text-decoration: none; 
              border-radius: 6px;
              margin: 20px 0;
            }
            .details { background: white; padding: 15px; border-left: 4px solid #8B5CF6; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚗 You're Invited to Join a Ride!</h1>
            </div>
            <div class="content">
              <h2>Hi there!</h2>
              <p><strong>${inviterName}</strong> has invited you to join their ride to <strong>${event.name}</strong>.</p>
              
              <div class="details">
                <h3>📍 Ride Details</h3>
                <p><strong>Event:</strong> ${event.name}</p>
                <p><strong>Destination:</strong> ${event.destination}, ${event.city}</p>
                <p><strong>Date:</strong> ${eventDate}</p>
                <p><strong>Travel Mode:</strong> ${rideDetails.travel_mode}</p>
                ${rideDetails.meeting_point ? `<p><strong>Meeting Point:</strong> ${rideDetails.meeting_point}</p>` : ''}
              </div>

              <p>To join this ride, you'll need to create a quick account:</p>
              
              <div style="text-align: center;">
                <a href="${registrationLink}" class="button">Create Account & Join Ride</a>
              </div>

              <p style="font-size: 14px; color: #666;">
                This invitation link expires in 3 days. If you have any questions, contact ${inviterName} directly.
              </p>
            </div>
            <div class="footer">
              <p>Berkeley Rides - Connecting students for safe, affordable travel</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('Email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invite sent successfully',
        existingUser: false
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in send-ride-invite:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send invite' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);
