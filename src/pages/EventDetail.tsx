import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin, Clock, Plus, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CreateRideDialog } from "@/components/CreateRideDialog";
import { RideGroupCard } from "@/components/RideGroupCard";

interface Event {
  id: string;
  name: string;
  date_time: string;
  destination: string;
  city: string;
  description: string | null;
}

interface RideGroup {
  id: string;
  departure_time: string;
  travel_mode: string;
  meeting_point: string | null;
  capacity: number;
  ride_members: { user_id: string }[];
}

const EventDetail = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [rideGroups, setRideGroups] = useState<RideGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [createRideOpen, setCreateRideOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setCurrentUserId(session.user.id);
        fetchEventData();
      }
    });
  }, [eventId, navigate]);

  const fetchEventData = async () => {
    if (!eventId) return;

    try {
      const [eventRes, ridesRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase
          .from('ride_groups')
          .select(`
            *,
            ride_members (user_id)
          `)
          .eq('event_id', eventId)
      ]);

      if (eventRes.error) throw eventRes.error;
      if (ridesRes.error) throw ridesRes.error;

      setEvent(eventRes.data);
      setRideGroups(ridesRes.data || []);
    } catch (error: any) {
      toast.error("Failed to load event details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Event not found</p>
          <Button onClick={() => navigate("/events")} className="mt-4">
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/events")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Events
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">{event.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(event.date_time), 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{format(new Date(event.date_time), 'h:mm a')}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{event.destination}, {event.city}</span>
            </div>
            {event.description && (
              <p className="text-sm text-muted-foreground pt-2 border-t">
                {event.description}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-primary">Ride Groups</h2>
          <Button onClick={() => setCreateRideOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Ride
          </Button>
        </div>

        {rideGroups.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No ride groups yet</p>
              <Button onClick={() => setCreateRideOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create the first ride group
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rideGroups.map((group) => (
              <RideGroupCard
                key={group.id}
                rideGroup={group}
                currentUserId={currentUserId}
                onUpdate={fetchEventData}
              />
            ))}
          </div>
        )}

        <Card className="mt-6 bg-secondary/50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Future Enhancement:</strong> Events will soon be automatically imported 
              from Luma, Eventbrite, Partiful, and Campus Groups APIs.
            </p>
          </CardContent>
        </Card>
      </div>

      <CreateRideDialog
        open={createRideOpen}
        onOpenChange={setCreateRideOpen}
        eventId={eventId!}
        eventDate={event.date_time}
        onRideCreated={fetchEventData}
      />
    </div>
  );
};

export default EventDetail;