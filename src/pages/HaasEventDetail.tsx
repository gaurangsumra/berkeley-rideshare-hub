import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Users, Calendar, MapPin, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreateRideDialog } from "@/components/CreateRideDialog";
import { RideGroupCard } from "@/components/RideGroupCard";
import { getTimeWindow, sortTimeWindows } from "@/lib/timeUtils";
import { Navigation } from "@/components/Navigation";
import { getEventByUid } from "@/lib/events";
import type { HaasEvent } from "@/types/event";

interface RideGroup {
  id: string;
  departure_time: string;
  travel_mode: string;
  meeting_point: string | null;
  capacity: number;
  min_capacity: number;
  created_by: string;
  event_id: string;
  ride_members: { user_id: string; role: string | null }[];
}

const HaasEventDetail = () => {
  const { eventUid } = useParams();
  const navigate = useNavigate();
  const [haasEvent, setHaasEvent] = useState<HaasEvent | null>(null);
  const [supabaseEventId, setSupabaseEventId] = useState<string | null>(null);
  const [rideGroups, setRideGroups] = useState<RideGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [createRideOpen, setCreateRideOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("photo")
        .eq("id", session.user.id)
        .single();

      if (!profileData?.photo) {
        navigate("/onboarding");
        return;
      }

      setCurrentUserId(session.user.id);
    });
  }, [navigate]);

  // Load Haas event from JSON
  useEffect(() => {
    if (!eventUid) return;
    const ev = getEventByUid(eventUid);
    if (ev) {
      setHaasEvent(ev);
    } else {
      setLoading(false);
    }
  }, [eventUid]);

  // Once we have the Haas event, look for a Supabase shadow event and its ride groups
  const fetchRideData = useCallback(async () => {
    if (!haasEvent) return;

    try {
      // Look up shadow event by name + date_time
      const { data: shadowEvent } = await supabase
        .from("events")
        .select("id")
        .eq("name", haasEvent.title)
        .eq("date_time", haasEvent.startDate)
        .maybeSingle();

      if (shadowEvent) {
        setSupabaseEventId(shadowEvent.id);

        const { data: rides, error } = await supabase
          .from("ride_groups")
          .select(`*, ride_members (user_id, role)`)
          .eq("event_id", shadowEvent.id);

        if (error) throw error;
        setRideGroups(rides || []);
      } else {
        setSupabaseEventId(null);
        setRideGroups([]);
      }
    } catch (error) {
      toast.error("Failed to load ride groups");
    } finally {
      setLoading(false);
    }
  }, [haasEvent]);

  useEffect(() => {
    if (haasEvent) {
      fetchRideData();
    }
  }, [haasEvent, fetchRideData]);

  // Ensure a Supabase shadow event exists and return its id
  const ensureSupabaseEvent = async (): Promise<string> => {
    if (supabaseEventId) return supabaseEventId;
    if (!haasEvent || !currentUserId) throw new Error("Not ready");

    // Double-check it doesn't exist (race condition guard)
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("name", haasEvent.title)
      .eq("date_time", haasEvent.startDate)
      .maybeSingle();

    if (existing) {
      setSupabaseEventId(existing.id);
      return existing.id;
    }

    const { data: created, error } = await supabase
      .from("events")
      .insert({
        name: haasEvent.title,
        destination: haasEvent.location || "TBD",
        city: "Berkeley",
        date_time: haasEvent.startDate,
        description: haasEvent.description || null,
        created_by: currentUserId,
      })
      .select("id")
      .single();

    if (error) throw error;
    setSupabaseEventId(created.id);
    return created.id;
  };

  const handleCreateRide = async () => {
    try {
      await ensureSupabaseEvent();
      setCreateRideOpen(true);
    } catch {
      toast.error("Failed to prepare event for ride creation");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!haasEvent) {
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

  // Group rides by time windows
  const groupedRides = rideGroups.reduce((acc, ride) => {
    const window = getTimeWindow(new Date(ride.departure_time));
    if (!acc[window]) acc[window] = [];
    acc[window].push(ride);
    return acc;
  }, {} as Record<string, RideGroup[]>);

  const sortedWindows = sortTimeWindows(Object.keys(groupedRides));

  // Event object for RideGroupCard compatibility
  const eventForCard = supabaseEventId
    ? {
        id: supabaseEventId,
        name: haasEvent.title,
        destination: haasEvent.location || "TBD",
        city: "Berkeley",
      }
    : null;

  return (
    <div className="min-h-screen bg-background pb-20 pt-6">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/events")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Events
        </Button>

        {/* Event Hero */}
        <div className="relative rounded-xl overflow-hidden mb-8 bg-gradient-to-br from-primary/90 to-primary text-primary-foreground p-8">
          <h1 className="text-3xl font-bold mb-4">{haasEvent.title}</h1>
          <div className="space-y-2 text-sm opacity-90">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                {format(new Date(haasEvent.startDate), "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                {format(new Date(haasEvent.startDate), "h:mm a")} &ndash;{" "}
                {format(new Date(haasEvent.endDate), "h:mm a")}
              </span>
            </div>
            {haasEvent.location && haasEvent.location !== "Location Unknown" && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <a
                  href={`https://www.google.com/maps?q=${encodeURIComponent(haasEvent.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:opacity-80"
                >
                  {haasEvent.location}
                </a>
              </div>
            )}
            {haasEvent.location === "Location Unknown" && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>Location Unknown</span>
              </div>
            )}
          </div>
          {haasEvent.description && (
            <p className="mt-4 text-sm opacity-80 whitespace-pre-line line-clamp-4">
              {haasEvent.description}
            </p>
          )}
          {haasEvent.url && (
            <a
              href={haasEvent.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-4 text-sm underline underline-offset-2 hover:opacity-80"
            >
              View on Campus Groups
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Ride Groups */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold text-primary">Ride Groups</h2>
          <Button onClick={handleCreateRide}>
            <Plus className="w-4 h-4 mr-2" />
            Create Ride
          </Button>
        </div>

        {rideGroups.length === 0 ? (
          <Card className="mb-8">
            <CardContent className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No ride groups yet</p>
              <Button onClick={handleCreateRide}>
                <Plus className="w-4 h-4 mr-2" />
                Create the first ride group
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8 mb-12">
            {sortedWindows.map((window) => (
              <div key={window} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <h3 className="text-lg font-semibold text-muted-foreground px-4">
                    {window}
                  </h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-4">
                  {groupedRides[window]
                    .sort(
                      (a, b) =>
                        new Date(a.departure_time).getTime() -
                        new Date(b.departure_time).getTime()
                    )
                    .map((group) => (
                      <RideGroupCard
                        key={group.id}
                        rideGroup={group}
                        currentUserId={currentUserId}
                        onUpdate={fetchRideData}
                        isAdmin={false}
                        event={eventForCard!}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {supabaseEventId && (
        <CreateRideDialog
          open={createRideOpen}
          onOpenChange={setCreateRideOpen}
          eventId={supabaseEventId}
          eventDate={haasEvent.startDate}
          onRideCreated={fetchRideData}
        />
      )}

      <Navigation />
    </div>
  );
};

export default HaasEventDetail;
