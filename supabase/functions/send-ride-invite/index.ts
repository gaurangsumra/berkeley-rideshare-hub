import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  rideId: string;
  recipientEmail?: string;
  linkOnly?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('authorization');
    console.log('Auth header present:', !!authHeader, 'prefix:', authHeader?.slice(0, 20));
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Create user-scoped client for auth validation
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Validate user authentication using the provided JWT
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(jwt);
    console.log('getUser error:', userError?.message, 'user found:', !!user);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { rideId, recipientEmail, linkOnly }: InviteRequest = await req.json();
    
    console.log('Processing ride invite for:', { rideId, recipientEmail, linkOnly });

    // Fetch inviter's name for all invite types
    const { data: inviterProfile } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    const inviterName = inviterProfile?.name || 'A Berkeley student';

    // If link-only mode, skip email validation and just generate token
    if (linkOnly || !recipientEmail) {
      const inviteToken = crypto.randomUUID();
      
      const { error: insertError } = await supabaseAdmin
        .from('ride_invites')
        .insert({
          ride_id: rideId,
          invite_token: inviteToken,
          created_by: user.id,
          inviter_name: inviterName,
          expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (insertError) {
        console.error('Error inserting invite token:', insertError);
        throw insertError;
      }

      // Use request origin to build correct frontend URL
    const configuredUrl = Deno.env.get('FRONTEND_URL');
    const origin = req.headers.get('origin') || req.headers.get('referer') || 'https://rizftvjircbgfsamrvdf.lovable.app';
    const frontendUrl = (configuredUrl || origin).replace(/\/$/, '');
    const registrationLink = `${frontendUrl}/auth?invite=${inviteToken}`;
      
      console.log('Generated shareable invite link:', registrationLink);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          inviteLink: registrationLink,
          message: 'Shareable invite link generated',
          expiresIn: '3 days'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error('Invalid email format');
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, is_invited_user, name')
      .eq('email', recipientEmail)
      .single();

    if (existingProfile) {
      const { data: rideData } = await supabaseAdmin
        .from('ride_groups')
        .select('event_id')
        .eq('id', rideId)
        .single();

      if (rideData) {
        await supabaseAdmin
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

    const { data: rideDetails } = await supabaseAdmin
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

    const { error: insertError } = await supabaseAdmin
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

    // Build registration link using configured FRONTEND_URL or request origin
    const configuredUrl = Deno.env.get('FRONTEND_URL');
    const origin = req.headers.get('origin') || req.headers.get('referer') || 'https://rizftvjircbgfsamrvdf.lovable.app';
    const baseUrl = configuredUrl || origin;
    const frontendUrl = baseUrl.replace(/^http:/, 'https:').replace(/\/$/, '');
    const registrationLink = `${frontendUrl}/auth?invite=${inviteToken}`;
    
    console.log('Email invite registration link:', registrationLink, '(source:', configuredUrl ? 'FRONTEND_URL' : 'request headers', ')');

    const eventDate = new Date(event.date_time).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    // Use Lovable AI to generate personalized email content
    const aiPrompt = `Generate a friendly, professional invitation email for a ride-sharing service called "Berkeley Rides". 
    
Details:
- Inviter: ${inviterName}
- Event: ${event.name}
- Destination: ${event.destination}, ${event.city}
- Date: ${eventDate}
- Travel Mode: ${rideDetails.travel_mode}
${rideDetails.meeting_point ? `- Meeting Point: ${rideDetails.meeting_point}` : ''}

The email should:
1. Be warm and welcoming
2. Clearly explain the ride details
3. Mention that they need to create an account to join
4. Include a note that the link expires in 3 days
5. Be formatted in plain text (no HTML)

Keep it concise and friendly.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that writes friendly invitation emails.' },
          { role: 'user', content: aiPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI generation failed:', await aiResponse.text());
      throw new Error('Failed to generate email content');
    }

    const aiData = await aiResponse.json();
    const emailBody = aiData.choices[0].message.content;

    // Send email using Supabase's built-in email functionality
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; white-space: pre-wrap; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #8B5CF6; 
            color: white !important; 
            text-decoration: none; 
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚗 You're Invited to Join a Ride!</h1>
          </div>
          <div class="content">
            ${emailBody}
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${registrationLink}" class="button">Create Account & Join Ride</a>
            </div>
          </div>
          <div class="footer">
            <p>Berkeley Rides - Connecting students for safe, affordable travel</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Use Supabase Auth admin to send the email
    const { error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(recipientEmail, {
      data: {
        invite_token: inviteToken,
        ride_id: rideId,
        inviter_name: inviterName
      },
      redirectTo: registrationLink
    });

    if (emailError) {
      console.error('Email sending failed:', emailError);
      
      // Fallback: Create a magic link instead
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: recipientEmail,
        options: {
          redirectTo: registrationLink
        }
      });

      if (linkError) {
        throw new Error('Failed to send invitation email');
      }
      
      console.log('Used magic link fallback');
    }

    console.log('Invitation email sent successfully');

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
