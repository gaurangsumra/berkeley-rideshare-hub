import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 
    | "member_joined"
    | "member_left"
    | "payment_request"
    | "ride_deleted"
    | "meeting_point_changed"
    | "new_chat_message";
  rideId: string;
  recipientEmails: string[];
  actorName?: string;
  eventName?: string;
  meetingPoint?: string;
  amount?: number;
  splitAmount?: number;
  messagePreview?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const {
      type,
      rideId,
      recipientEmails,
      actorName,
      eventName,
      meetingPoint,
      amount,
      splitAmount,
      messagePreview,
    }: NotificationRequest = await req.json();

    console.log(`Sending ${type} notification for ride ${rideId} to ${recipientEmails.length} recipients`);

    // Fetch ride details
    const { data: ride } = await supabase
      .from("ride_groups")
      .select("departure_time, travel_mode, events(name, destination)")
      .eq("id", rideId)
      .single();

    const event = ride?.events?.[0] as { name: string; destination: string } | undefined;
    const finalEventName = eventName || event?.name || "your event";
    const destination = event?.destination || "";

    // Format departure time
    const departureDate = ride?.departure_time
      ? new Date(ride.departure_time).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

    // Build email content based on notification type
    let subject = "";
    let html = "";

    switch (type) {
      case "member_joined":
        subject = `${actorName} joined your ride to ${finalEventName}`;
        html = `
          <h2>New Member Joined!</h2>
          <p><strong>${actorName}</strong> has joined your ride group to <strong>${finalEventName}</strong>.</p>
          <p><strong>Departure:</strong> ${departureDate}</p>
          <p><strong>Travel Mode:</strong> ${ride?.travel_mode}</p>
          ${meetingPoint ? `<p><strong>Meeting Point:</strong> ${meetingPoint}</p>` : ""}
          <p>Check your ride group for updates and to coordinate with your group.</p>
        `;
        break;

      case "member_left":
        subject = `${actorName} left your ride to ${finalEventName}`;
        html = `
          <h2>Member Left Ride</h2>
          <p><strong>${actorName}</strong> has left your ride group to <strong>${finalEventName}</strong>.</p>
          <p><strong>Departure:</strong> ${departureDate}</p>
          <p>You may need to adjust your plans or invite someone else to fill the spot.</p>
        `;
        break;

      case "payment_request":
        subject = `Payment request: $${splitAmount} for ride to ${finalEventName}`;
        html = `
          <h2>Payment Request</h2>
          <p><strong>${actorName}</strong> paid for your Uber ride to <strong>${finalEventName}</strong>.</p>
          <p><strong>Total Fare:</strong> $${amount}</p>
          <p><strong>Your Share:</strong> $${splitAmount}</p>
          <p>Please send your payment via Venmo to settle up.</p>
          <p><strong>Departure was:</strong> ${departureDate}</p>
        `;
        break;

      case "ride_deleted":
        subject = `Ride to ${finalEventName} has been cancelled`;
        html = `
          <h2>Ride Cancelled</h2>
          <p>The ride group to <strong>${finalEventName}</strong> (${destination}) has been cancelled.</p>
          <p><strong>Original Departure:</strong> ${departureDate}</p>
          <p>You may need to find alternative transportation or join another ride group.</p>
        `;
        break;

      case "meeting_point_changed":
        subject = `Meeting point set for ride to ${finalEventName}`;
        html = `
          <h2>Meeting Point Confirmed</h2>
          <p>The meeting point for your ride to <strong>${finalEventName}</strong> has been set.</p>
          <p><strong>Meeting Point:</strong> ${meetingPoint}</p>
          <p><strong>Departure:</strong> ${departureDate}</p>
          <p><strong>Travel Mode:</strong> ${ride?.travel_mode}</p>
          <p>Make sure to arrive on time!</p>
        `;
        break;

      case "new_chat_message":
        subject = `New message in your ride to ${finalEventName}`;
        html = `
          <h2>New Chat Message</h2>
          <p><strong>${actorName}</strong> sent a message in your ride group to <strong>${finalEventName}</strong>.</p>
          <p><em>"${messagePreview}"</em></p>
          <p><strong>Departure:</strong> ${departureDate}</p>
          <p><a href="${supabaseUrl.replace('/rest/v1', '')}/rides/${rideId}?openChat=true" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">View Chat</a></p>
          <p>Log in to view the full conversation and respond.</p>
        `;
        break;
    }

    // Send emails to all recipients
    const emailPromises = recipientEmails.map(async (email) => {
      return await resend.emails.send({
        from: "Berkeley Rides <notifications@resend.dev>",
        to: [email],
        subject: subject,
        html: html,
      });
    });

    const results = await Promise.allSettled(emailPromises);
    
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failureCount = results.filter((r) => r.status === "rejected").length;

    console.log(`Email notifications sent: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-ride-notification function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
