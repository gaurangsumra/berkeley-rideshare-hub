import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Clock, Users, MapPin, MessageCircle, Share2, DollarSign, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { RideGroupChat } from "@/components/RideGroupChat";
import { MeetingPointVoting } from "@/components/MeetingPointVoting";
import { ShareRideDetails } from "@/components/ShareRideDetails";
import { UberPaymentDialog } from "@/components/UberPaymentDialog";
import { InviteDialog } from "@/components/InviteDialog";
import { AttendanceSurveyDialog } from "@/components/AttendanceSurveyDialog";
import { RatingBadge } from "@/components/RatingBadge";
import { Navigation } from "@/components/Navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RideGroup {
  id: string;
  departure_time: string;
  travel_mode: string;
  meeting_point: string | null;
  capacity: number;
  event_id: string;
  created_by: string;
}

interface Event {
  id: string;
  name: string;
  date_time: string;
  destination: string;
  city: string;
}

interface Member {
  id: string;
  name: string;
  photo: string | null;
  program: string;
  role: string | null;
}

const RideDetail = () => {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState<RideGroup | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showVoting, setShowVoting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [leaderMeetingPoint, setLeaderMeetingPoint] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    checkAuthAndFetch();
  }, [rideId, navigate]);

  useEffect(() => {
    if (rideId) {
      fetchLeaderMeetingPoint();
      const channel = supabase
        .channel(`meeting_votes_${rideId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'meeting_votes', filter: `ride_id=eq.${rideId}` },
          () => fetchLeaderMeetingPoint()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [rideId]);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('photo')
      .eq('id', session.user.id)
      .single();

    if (!profile?.photo) {
      navigate("/onboarding");
      return;
    }

    setCurrentUserId(session.user.id);
    fetchRideData();
  };

  const fetchRideData = async () => {
    if (!rideId) return;

    try {
      const { data: rideData, error: rideError } = await supabase
        .from('ride_groups')
        .select('*')
        .eq('id', rideId)
        .single();

      if (rideError) throw rideError;
      if (!rideData) {
        toast.error("Ride not found");
        navigate("/events");
        return;
      }

      setRide(rideData);

      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', rideData.event_id)
        .single();

      if (eventData) setEvent(eventData);

      const { data: memberData } = await supabase
        .from('ride_members')
        .select('user_id, role')
        .eq('ride_id', rideId);

      if (memberData) {
        const memberIds = memberData.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('*')
          .in('id', memberIds);

        if (profiles) {
          const membersWithRoles = profiles.map(p => {
            const memberRole = memberData.find(m => m.user_id === p.id)?.role;
            return { ...p, role: memberRole || null };
          });
          setMembers(membersWithRoles);
        }
      }
    } catch (error: any) {
      console.error("Failed to load ride:", error);
      toast.error("Failed to load ride details");
    } finally {
      setLoading(false);
    }
  };

  // Auto-open chat if openChat query parameter is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openChat') === 'true' && currentUserId && members.some(m => m.id === currentUserId)) {
      setShowChat(true);
      // Clean up the URL
      window.history.replaceState({}, '', `/rides/${rideId}`);
    }
  }, [members, currentUserId, rideId]);

  const fetchLeaderMeetingPoint = async () => {
    if (!rideId) return;

    try {
      const { data, error } = await supabase
        .from('meeting_votes')
        .select('vote_option')
        .eq('ride_id', rideId);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach(v => {
        counts[v.vote_option] = (counts[v.vote_option] || 0) + 1;
      });

      const entries = Object.entries(counts);
      if (entries.length === 0) {
        setLeaderMeetingPoint(null);
        return;
      }

      const maxVotes = Math.max(...entries.map(([_, count]) => count));
      const winners = entries
        .filter(([_, count]) => count === maxVotes)
        .map(([option]) => option)
        .sort();

      setLeaderMeetingPoint(winners.join(' OR '));
    } catch (error) {
      console.error('Failed to fetch leader meeting point', error);
    }
  };

  const handleJoinRide = async () => {
    if (!currentUserId || !ride) return;

    try {
      setActionLoading(true);

      // Check if user is already in another ride for this event
      const { data: existingMembership } = await supabase
        .from('ride_members')
        .select(`
          ride_id,
          ride_groups!inner(
            id,
            event_id,
            travel_mode,
            departure_time
          )
        `)
        .eq('user_id', currentUserId)
        .eq('status', 'joined')
        .eq('ride_groups.event_id', ride.event_id)
        .neq('ride_id', ride.id);

      if (existingMembership && existingMembership.length > 0) {
        const existingRide = existingMembership[0].ride_groups;
        toast.error(
          `You're already in a ride group for this event (departing at ${format(new Date(existingRide.departure_time), 'h:mm a')}). Please leave that group first.`,
          { duration: 5000 }
        );
        setActionLoading(false);
        return;
      }

      const isCarpool = ride.travel_mode === 'Carpool (Student Driver)';
      const role = isCarpool ? 'rider' : null;

      const { error } = await supabase.from('ride_members').insert({
        ride_id: ride.id,
        user_id: currentUserId,
        status: 'joined',
        role: role,
      });

      if (error) throw error;

      toast.success("Joined ride group!");
      fetchRideData();
    } catch (error: any) {
      toast.error(error.message || "Failed to join ride");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveRide = async () => {
    if (!currentUserId || !ride) return;

    try {
      setActionLoading(true);

      const { error } = await supabase
        .from('ride_members')
        .delete()
        .eq('ride_id', ride.id)
        .eq('user_id', currentUserId);

      if (error) throw error;

      toast.success("Left ride group");
      setShowLeaveDialog(false);
      fetchRideData();
    } catch (error: any) {
      toast.error(error.message || "Failed to leave ride");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRide = async () => {
    if (!ride) return;

    try {
      setActionLoading(true);

      const { error: memberError } = await supabase
        .from('ride_members')
        .delete()
        .eq('ride_id', ride.id);

      if (memberError) throw memberError;

      const { error } = await supabase
        .from('ride_groups')
        .delete()
        .eq('id', ride.id);

      if (error) throw error;

      toast.success("Ride group deleted");
      navigate(`/events/${event?.id || ''}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete ride group");
    } finally {
      setActionLoading(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!ride || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <div className="text-center">
          <p className="text-muted-foreground">Ride not found</p>
          <Button onClick={() => navigate("/events")} className="mt-4">
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const isMember = currentUserId && members.some(m => m.id === currentUserId);
  const isDriver = currentUserId && members.some(m => m.id === currentUserId && m.role === 'driver');
  const isFull = members.length >= ride.capacity;
  const canDeleteRide = members.length <= 1 && isMember;
  const isCarpool = ride.travel_mode === 'Carpool (Student Driver)';
  const driver = members.find(m => m.role === 'driver');
  const passengerCount = members.filter(m => m.role !== 'driver').length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navigation />
      
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(`/events/${event.id}`)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Event
        </Button>

        {/* Event Context */}
        <Card className="mb-6 bg-gradient-to-br from-primary/10 to-accent/10">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h1 className="text-2xl font-bold text-primary mb-1">{event.name}</h1>
                <p className="text-muted-foreground">{event.destination}, {event.city}</p>
              </div>
              <Badge variant="secondary">
                {format(new Date(event.date_time), 'MMM d, yyyy')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Ride Details */}
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Departure Time</p>
                  <p className="font-semibold">{format(new Date(ride.departure_time), 'h:mm a')}</p>
                </div>
              </div>
              <Badge variant={ride.travel_mode.includes('Rideshare') ? 'default' : 'secondary'}>
                {ride.travel_mode.includes('Rideshare') ? 'Rideshare (Uber/Lyft)' : 'Carpool'}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Capacity</p>
                <p className="font-semibold">
                  {isCarpool 
                    ? `${passengerCount} passenger${passengerCount !== 1 ? 's' : ''} + driver`
                    : `${members.length}/${ride.capacity} members`
                  }
                </p>
              </div>
            </div>

            {(leaderMeetingPoint || ride.meeting_point) && (
              <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Meeting Point</p>
                  <a 
                    href={`https://www.google.com/maps?q=${encodeURIComponent(leaderMeetingPoint ?? ride.meeting_point ?? '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold hover:underline text-primary"
                  >
                    {leaderMeetingPoint ?? ride.meeting_point}
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Driver Section */}
        {isCarpool && driver && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground mb-3">DRIVER</p>
              <Link to={`/users/${driver.id}`} className="flex items-center gap-3 hover:bg-accent/50 p-2 rounded-lg transition-colors">
                <Avatar className="w-12 h-12 border-2 border-primary">
                  <AvatarImage src={driver.photo || undefined} />
                  <AvatarFallback>{driver.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{driver.name}</p>
                    <RatingBadge userId={driver.id} size="small" />
                  </div>
                  <p className="text-sm text-muted-foreground">{driver.program}</p>
                </div>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Members Section */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-3">
              {isCarpool ? 'Passengers:' : 'Members:'}
            </p>
            <div className="space-y-2">
              {members.filter(m => !isCarpool || m.id !== driver?.id).map((member) => (
                <Link
                  key={member.id}
                  to={`/users/${member.id}`}
                  className="flex items-center gap-3 hover:bg-accent/50 p-2 rounded-lg transition-colors"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={member.photo || undefined} />
                    <AvatarFallback>
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.name}</p>
                      <RatingBadge userId={member.id} size="small" />
                    </div>
                    <p className="text-xs text-muted-foreground">{member.program}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {!isMember && !isFull && (
            <Button 
              onClick={handleJoinRide} 
              disabled={actionLoading}
              className="w-full"
              size="lg"
            >
              Join Ride
            </Button>
          )}

          {isMember && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => setShowVoting(true)}
                  variant="outline"
                  size="lg"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Vote Meeting Point
                </Button>
                <Button
                  onClick={() => setShowChat(true)}
                  variant="outline"
                  size="lg"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Group Chat
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => setShowShare(true)}
                  variant="outline"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <Button
                  onClick={() => setShowInvite(true)}
                  variant="outline"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite
                </Button>
              </div>

              {ride.travel_mode.includes('Rideshare') && (
                <Button
                  onClick={() => setShowPayment(true)}
                  variant="outline"
                  className="w-full"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Rideshare Payment
                </Button>
              )}

              {isDriver ? (
                <Button
                  variant="outline"
                  disabled
                  className="w-full"
                  title="As the driver, you cannot leave. Delete the ride group instead."
                >
                  Driver Cannot Leave
                </Button>
              ) : (
                <Button
                  onClick={() => setShowLeaveDialog(true)}
                  variant="outline"
                  disabled={actionLoading}
                  className="w-full"
                >
                  Leave Ride
                </Button>
              )}

              {canDeleteRide && (
                <Button
                  onClick={() => setShowDeleteDialog(true)}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Ride Group
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <RideGroupChat
        open={showChat}
        onOpenChange={setShowChat}
        rideId={ride.id}
        rideName={`${event.name} - ${format(new Date(ride.departure_time), 'h:mm a')}`}
      />

      {showVoting && (
        <MeetingPointVoting
          rideId={ride.id}
          currentMeetingPoint={ride.meeting_point}
          onClose={() => setShowVoting(false)}
          onUpdate={fetchLeaderMeetingPoint}
        />
      )}

      {showShare && (
        <ShareRideDetails
          rideId={ride.id}
          event={event}
          ride={{
            departure_time: ride.departure_time,
            travel_mode: ride.travel_mode,
            meeting_point: leaderMeetingPoint ?? ride.meeting_point
          }}
          members={members}
          driver={driver || null}
          open={showShare}
          onOpenChange={setShowShare}
        />
      )}

      {showPayment && currentUserId && (
        <UberPaymentDialog
          open={showPayment}
          onOpenChange={setShowPayment}
          rideId={ride.id}
          members={members}
          currentUserId={currentUserId}
        />
      )}

      <InviteDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        rideId={ride.id}
      />

      <AttendanceSurveyDialog
        open={showAttendance}
        onOpenChange={setShowAttendance}
        rideId={ride.id}
        eventName={event.name}
      />

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Ride Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this ride group? Other members will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveRide} disabled={actionLoading}>
              {actionLoading ? "Leaving..." : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ride Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this ride group? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRide}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RideDetail;
