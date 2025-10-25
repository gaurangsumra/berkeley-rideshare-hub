import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { RideCard } from "@/components/RideCard";
import { toast } from "sonner";

interface Ride {
  id: string;
  event_id: string;
  departure_time: string;
  travel_mode: string;
  meeting_point: string | null;
  driver?: {
    name: string;
    photo: string | null;
  };
  events: {
    name: string;
    destination: string;
    city: string;
    date_time: string;
  };
}

const MyRides = () => {
  const navigate = useNavigate();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user has completed onboarding
      const { data: profileData } = await supabase
        .from('profiles')
        .select('photo')
        .eq('id', session.user.id)
        .single();

      if (!profileData?.photo) {
        navigate("/onboarding");
        return;
      }

      fetchMyRides(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchMyRides = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('ride_members')
        .select(`
          ride_id,
          ride_groups (
            id,
            event_id,
            departure_time,
            travel_mode,
            meeting_point,
            ride_members!inner (
              user_id,
              role,
              profiles:user_id (
                name,
                photo
              )
            ),
            events (
              name,
              destination,
              city,
              date_time
            )
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'joined')
        .gte('ride_groups.events.date_time', new Date().toISOString());

      if (error) throw error;

      const formattedRides = data
        ?.filter(item => item.ride_groups)
        .map(item => {
          const driverMember = item.ride_groups.ride_members?.find(m => m.role === 'driver');
          return {
            id: item.ride_groups.id,
            event_id: item.ride_groups.event_id,
            departure_time: item.ride_groups.departure_time,
            travel_mode: item.ride_groups.travel_mode,
            meeting_point: item.ride_groups.meeting_point,
            driver: driverMember?.profiles ? {
              name: driverMember.profiles.name,
              photo: driverMember.profiles.photo
            } : undefined,
            events: item.ride_groups.events
          };
        }) || [];

      setRides(formattedRides);
    } catch (error: any) {
      toast.error("Failed to load your rides");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary">My Rides</h1>
          <p className="text-muted-foreground mt-1">Your upcoming ride groups</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">You haven't joined any rides yet</p>
            <p className="text-sm text-muted-foreground mt-2">Browse events to find rides</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rides.map((ride) => (
              <RideCard key={ride.id} ride={ride} />
            ))}
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
};

export default MyRides;