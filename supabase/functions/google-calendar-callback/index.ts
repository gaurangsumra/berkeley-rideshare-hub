import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // user ID
    const error = url.searchParams.get('error');

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (state && !uuidRegex.test(state)) {
      console.error('Invalid state parameter format');
      return new Response(
        `<html><body><script>
          window.opener?.postMessage({ type: 'CALENDAR_AUTH_ERROR', error: 'Invalid authentication state' }, '*');
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // If user denied access
    if (error) {
      console.error('OAuth error occurred');
      const safeError = JSON.stringify(error).slice(1, -1);
      return new Response(
        `<html><body><script>
          window.opener?.postMessage({ type: 'CALENDAR_AUTH_ERROR', error: '${safeError}' }, '*');
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!clientId || !clientSecret || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error');
    }

    const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-callback`;

    console.log('Exchanging code for tokens for authenticated user');

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      throw new Error('Failed to exchange authorization code');
    }

    const tokens = await tokenResponse.json();
    
    // Calculate expiry timestamp
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    console.log('Storing tokens in database for authenticated user');

    // Store tokens in database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error: dbError } = await supabase
      .from('calendar_tokens')
      .upsert({
        user_id: state,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'user_id,provider'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store tokens');
    }

    console.log('Successfully stored tokens for authenticated user');

    // Close popup and notify parent window
    return new Response(
      `<html><body><script>
        window.opener.postMessage({ type: 'CALENDAR_AUTH_SUCCESS' }, '*');
        window.close();
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('Error in callback');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const safeErrorMessage = JSON.stringify(errorMessage).slice(1, -1);
    return new Response(
      `<html><body><script>
        window.opener?.postMessage({ type: 'CALENDAR_AUTH_ERROR', error: '${safeErrorMessage}' }, '*');
        window.close();
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
