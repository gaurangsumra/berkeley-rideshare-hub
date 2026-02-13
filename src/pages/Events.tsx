import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Navigation } from "@/components/Navigation";
import { EventCard } from "@/components/EventCard";
import { format } from "date-fns";
import { getAllEvents } from "@/lib/events";
import type { HaasEvent } from "@/types/event";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

const Events = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<HaasEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/auth");
      }
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    setLoading(true);
    setEvents(getAllEvents());
    setLoading(false);
  }, []);

  const handleGoogleConnect = () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const supabaseFunctionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
    
    if (!googleClientId || !supabaseFunctionsUrl) {
      console.error("Missing Google Client ID or Supabase Functions URL environment variables.");
      // Optionally, show a user-friendly error message
      return;
    }

    const redirectUri = `${supabaseFunctionsUrl}/google-oauth-callback`; // This will be our Supabase Edge Function endpoint
    const scope = "https://www.googleapis.com/auth/calendar.events.readonly";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    
    window.location.href = authUrl;
  };

  const groupEventsByDate = (events: HaasEvent[]) => {
    const now = new Date();
    const upcomingEvents = events.filter(e => new Date(e.startDate) >= now);
    const pastEvents = events.filter(e => new Date(e.startDate) < now);

    const sortedEvents = [...upcomingEvents, ...pastEvents];

    const grouped = sortedEvents.reduce((acc, event) => {
      const dateKey = format(new Date(event.startDate), 'EEEE, MMMM d, yyyy');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(event);
      return acc;
    }, {} as Record<string, HaasEvent[]>);

    return Object.entries(grouped);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="space-y-4 mb-6">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold text-primary">Haas Events</h1>
            <p className="text-muted-foreground mt-1">Events imported from the Haas Campus Groups calendar</p>
            <Button onClick={handleGoogleConnect} className="mt-4">
              <Upload className="w-4 h-4 mr-2" />
              Connect Google Calendar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No events found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupEventsByDate(events).map(([date, dateEvents]) => (
              <div key={date} className="space-y-3">
                <h2 className="text-lg font-semibold text-primary border-b pb-2">
                  {date}
                </h2>
                <div className="space-y-3">
                  {dateEvents.map((event) => {
                    const isPastEvent = new Date(event.startDate) < new Date();
                    return <EventCard key={event.uid} event={event} isPastEvent={isPastEvent} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
};

export default Events;
