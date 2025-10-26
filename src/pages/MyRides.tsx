import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { RideCard } from "@/components/RideCard";
import { AttendanceSurveyDialog } from "@/components/AttendanceSurveyDialog";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

interface PendingSurvey {
  id: string;
  ride_id: string;
  survey_deadline: string;
  ride_groups: {
    id: string;
    event_id: string;
    events: {
      name: string;
    };
  };
}

const MyRides = () => {
  const navigate = useNavigate();
  const [rides, setRides] = useState<Ride[]>([]);
  const [pendingSurveys, setPendingSurveys] = useState<PendingSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [surveyDialogOpen, setSurveyDialogOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<PendingSurvey | null>(null);

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
      fetchPendingSurveys(session.user.id);
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
        ?.filter(item => item.ride_groups && item.ride_groups.events)
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
            events: item.ride_groups.events!
          };
        }) || [];

      setRides(formattedRides);
    } catch (error: any) {
      toast.error("Failed to load your rides");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingSurveys = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('ride_attendance_surveys')
        .select(`
          id,
          ride_id,
          survey_deadline,
          ride_groups!inner(
            id,
            event_id,
            events(name),
            ride_members!inner(user_id)
          ),
          ride_attendance_responses(respondent_user_id)
        `)
        .eq('ride_groups.ride_members.user_id', userId)
        .in('survey_status', ['pending', 'in_progress'])
        .gt('survey_deadline', new Date().toISOString());

      if (error) throw error;

      // Filter out surveys where user already responded
      const filtered = data?.filter(survey => {
        const responses = survey.ride_attendance_responses as any[];
        return !responses?.some(r => r.respondent_user_id === userId);
      }) || [];

      setPendingSurveys(filtered as any);
    } catch (error: any) {
      console.error('Error fetching pending surveys:', error);
    }
  };

  const handleOpenSurvey = (survey: PendingSurvey) => {
    setSelectedSurvey(survey);
    setSurveyDialogOpen(true);
  };

  const handleSurveySubmitted = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      fetchPendingSurveys(session.user.id);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary">My Rides</h1>
          <p className="text-muted-foreground mt-1">Your upcoming ride groups</p>
        </div>

        {/* Pending Surveys Section */}
        {pendingSurveys.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Action Required
            </h2>
            <div className="space-y-3">
              {pendingSurveys.map((survey) => (
                <Card key={survey.id} className="border-destructive/50 bg-destructive/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {survey.ride_groups.events.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Please confirm who showed up to this ride
                        </p>
                      </div>
                      <Button 
                        onClick={() => handleOpenSurvey(survey)}
                        variant="destructive"
                        size="sm"
                      >
                        Complete Survey
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

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

      {selectedSurvey && (
        <AttendanceSurveyDialog
          open={surveyDialogOpen}
          onOpenChange={setSurveyDialogOpen}
          rideId={selectedSurvey.ride_id}
          eventName={selectedSurvey.ride_groups.events.name}
          onSubmitted={handleSurveySubmitted}
        />
      )}

      <Navigation />
    </div>
  );
};

export default MyRides;