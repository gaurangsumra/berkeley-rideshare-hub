import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, Users, MapPin, UserPlus, Trash2, MessageCircle, Share2, CheckCircle, Pencil } from "lucide-react";
import { RideGroupChat } from "@/components/RideGroupChat";
import { CapacityVisualization } from "@/components/CapacityVisualization";
import { ShareRideDetails } from "@/components/ShareRideDetails";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { RatingBadge } from "@/components/RatingBadge";
import { format } from "date-fns";
import { toast } from "sonner";
import { MeetingPointVoting } from "@/components/MeetingPointVoting";
import { UberPaymentDialog } from "@/components/UberPaymentDialog";
import { InviteDialog } from "@/components/InviteDialog";
import { AttendanceSurveyDialog } from "@/components/AttendanceSurveyDialog";
import { EditRideDialog } from "@/components/EditRideDialog";
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
  min_capacity: number;
  created_by: string;
  event_id: string;
  ride_members: { user_id: string; role: string | null }[];
}

interface Profile {
  id: string;
  name: string;
  photo: string | null;
  program: string;
}

interface RideGroupCardProps {
  rideGroup: RideGroup;
  currentUserId: string | null;
  onUpdate: () => void;
  isAdmin: boolean;
  event: {
    id: string;
    name: string;
    destination: string;
    city: string;
  };
}

export const RideGroupCard = ({ rideGroup, currentUserId, onUpdate, isAdmin, event }: RideGroupCardProps) => {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showVoting, setShowVoting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [leaderMeetingPoint, setLeaderMeetingPoint] = useState<string | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const isMember = currentUserId && rideGroup.ride_members.some(m => m.user_id === currentUserId);
  const isDriver = currentUserId && rideGroup.ride_members.some(m => m.user_id === currentUserId && m.role === 'driver');
  const isFull = rideGroup.ride_members.length >= rideGroup.capacity;
  const canDeleteRide = rideGroup.ride_members.length <= 1 && (isAdmin || isMember);
  const isCreator = currentUserId === rideGroup.created_by;
  const driver = members.find(m =>
    rideGroup.ride_members.find(rm => rm.user_id === m.id && rm.role === 'driver')
  );
  const isCarpool = rideGroup.travel_mode === 'Carpool (Student Driver)';
  const passengerCount = rideGroup.ride_members.filter(m => m.role !== 'driver').length;

  useEffect(() => {
    fetchMembers();
  }, [rideGroup.id]);

  // Auto-open chat if openChat query parameter is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openChat') === 'true' && isMember) {
      setShowChat(true);
      // Clean up the URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isMember]);

  // Keep leader in sync with votes (realtime)
  useEffect(() => {
    fetchLeader();
    const channel = supabase
      .channel(`meeting_votes_${rideGroup.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_votes', filter: `ride_id=eq.${rideGroup.id}` },
        () => fetchLeader()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideGroup.id]);

  const fetchMembers = async () => {
    try {
      const memberIds = rideGroup.ride_members.map(m => m.user_id);
      const { data, error } = await supabase
        .from('public_profiles')
        .select('*')
        .in('id', memberIds);

      if (error) throw error;

      // Create placeholder profiles for members not in public_profiles
      const fetchedIds = data?.map(p => p.id) || [];
      const missingIds = memberIds.filter(id => !fetchedIds.includes(id));

      const placeholderProfiles = missingIds.map(id => ({
        id,
        name: 'User',
        photo: null,
        program: 'Unknown',
        created_at: new Date().toISOString()
      }));

      setMembers([...(data || []), ...placeholderProfiles]);
    } catch (error: any) {
      // Failed to load members
    }
  };

  const fetchLeader = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_votes')
        .select('vote_option')
        .eq('ride_id', rideGroup.id);
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
        .sort(); // Sort alphabetically for consistency

      const result = winners.join(' OR ');
      setLeaderMeetingPoint(result);
    } catch (e) {
      // Failed to fetch leader meeting point
    }
  };

  const handleJoinRide = async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);

      // Get the event_id from the ride group to check for conflicts
      const { data: rideData } = await supabase
        .from('ride_groups')
        .select('event_id')
        .eq('id', rideGroup.id)
        .single();

      if (rideData) {
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
          .eq('ride_groups.event_id', rideData.event_id)
          .neq('ride_id', rideGroup.id);

        if (existingMembership && existingMembership.length > 0) {
          const existingRide = existingMembership[0].ride_groups;
          toast.error(
            `You're already in a ride group for this event (departing at ${format(new Date(existingRide.departure_time), 'h:mm a')}). Please leave that group first.`,
            { duration: 5000 }
          );
          setLoading(false);
          return;
        }
      }

      const role = isCarpool ? 'rider' : null;

      const { error } = await supabase.from('ride_members').insert({
        ride_id: rideGroup.id,
        user_id: currentUserId,
        status: 'joined',
        role: role,
      });

      if (error) throw error;

      // Notify other members
      const memberIds = rideGroup.ride_members.map(m => m.user_id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', currentUserId)
        .single();

      for (const memberId of memberIds) {
        await supabase.from('notifications').insert({
          user_id: memberId,
          ride_id: rideGroup.id,
          type: 'member_joined',
          title: 'New member joined',
          message: `${profile?.name || 'Someone'} joined your ride group`,
        });
      }

      // Send email notifications
      const { data: memberEmails } = await supabase
        .from('profiles')
        .select('email')
        .in('id', memberIds);

      if (memberEmails && memberEmails.length > 0) {
        await supabase.functions.invoke('send-ride-notification', {
          body: {
            type: 'member_joined',
            rideId: rideGroup.id,
            recipientEmails: memberEmails.map(m => m.email),
            actorName: profile?.name || 'Someone',
            eventName: event.name,
            meetingPoint: leaderMeetingPoint ?? rideGroup.meeting_point,
          }
        });
      }

      // Check if group is ready (3/4 full)
      if (rideGroup.ride_members.length + 1 >= 3 && rideGroup.capacity === 4) {
        for (const memberId of [...memberIds, currentUserId]) {
          await supabase.from('notifications').insert({
            user_id: memberId,
            ride_id: rideGroup.id,
            type: 'group_ready',
            title: 'Ride group almost full!',
            message: `Your ride group is ${rideGroup.ride_members.length + 1}/4 full`,
          });
        }
      }

      const message = role === 'rider'
        ? `Joined as rider in ${driver?.name}'s ride!`
        : "Joined ride group!";
      toast.success(message);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Failed to join ride");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRide = async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);

      // Notify other members
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const memberIds = rideGroup.ride_members
          .filter(m => m.user_id !== currentUserId)
          .map(m => m.user_id);

        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', currentUserId)
          .single();

        for (const memberId of memberIds) {
          await supabase.from('notifications').insert({
            user_id: memberId,
            ride_id: rideGroup.id,
            type: 'member_left',
            title: 'Member left your ride',
            message: `A member has left the ride group`,
          });
        }

        // Send email notifications
        const { data: memberEmails } = await supabase
          .from('profiles')
          .select('email')
          .in('id', memberIds);

        if (memberEmails && memberEmails.length > 0) {
          await supabase.functions.invoke('send-ride-notification', {
            body: {
              type: 'member_left',
              rideId: rideGroup.id,
              recipientEmails: memberEmails.map(m => m.email),
              actorName: profile?.name || 'Someone',
              eventName: event.name,
            }
          });
        }
      }

      const { error } = await supabase
        .from('ride_members')
        .delete()
        .eq('ride_id', rideGroup.id)
        .eq('user_id', currentUserId);

      if (error) throw error;
      toast.success("Left ride group");
      setShowLeaveDialog(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Failed to leave ride");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRide = async () => {
    try {
      setLoading(true);

      // Notify all members before deletion
      const memberIds = rideGroup.ride_members.map(m => m.user_id);
      const { data: memberEmails } = await supabase
        .from('profiles')
        .select('email')
        .in('id', memberIds);

      // Send email notifications before deletion
      if (memberEmails && memberEmails.length > 0) {
        await supabase.functions.invoke('send-ride-notification', {
          body: {
            type: 'ride_deleted',
            rideId: rideGroup.id,
            recipientEmails: memberEmails.map(m => m.email),
            eventName: event.name,
          }
        });
      }

      // First, explicitly delete all members to ensure clean state
      const { error: memberError } = await supabase
        .from('ride_members')
        .delete()
        .eq('ride_id', rideGroup.id);

      if (memberError) throw memberError;

      // Then delete the ride group
      const { error } = await supabase
        .from('ride_groups')
        .delete()
        .eq('id', rideGroup.id);

      if (error) throw error;
      toast.success("Ride group deleted");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete ride group");
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <Card className="transition-colors hover:border-accent">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {format(new Date(rideGroup.departure_time), 'h:mm a')}
          </CardTitle>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant={rideGroup.travel_mode.includes('Rideshare') ? 'default' : 'secondary'}>
              {rideGroup.travel_mode.includes('Rideshare') ? 'Rideshare (Uber/Lyft)' : 'Carpool'}
            </Badge>
            <Badge variant="outline">
              <Users className="w-3 h-3 mr-1" />
              {isCarpool
                ? `${passengerCount} passenger${passengerCount !== 1 ? 's' : ''} + driver`
                : `${rideGroup.ride_members.length}/${rideGroup.capacity}`
              }
            </Badge>
            {isCreator && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowEditDialog(true)}
                className="h-8 w-8"
                title="Edit ride details"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDeleteRide && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {(leaderMeetingPoint || rideGroup.meeting_point) && (
          <div className="flex items-center gap-2 text-sm text-primary font-medium p-3 bg-primary/5 rounded-lg">
            <MapPin className="w-4 h-4" />
            <span>Meeting Point: </span>
            <a
              href={`https://www.google.com/maps?q=${encodeURIComponent(leaderMeetingPoint ?? rideGroup.meeting_point ?? '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline transition-colors"
            >
              {leaderMeetingPoint ?? rideGroup.meeting_point}
            </a>
          </div>
        )}

        {isCarpool && driver && (
          <div className="bg-accent/10 p-3 rounded-lg mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">DRIVER</p>
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border-2 border-primary">
                <AvatarImage src={driver.photo || undefined} />
                <AvatarFallback>{driver.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{driver.name}</p>
                <p className="text-xs text-muted-foreground">{driver.program}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-medium mb-2">
            {isCarpool ? 'Passengers:' : 'Members:'}
          </p>
          <div className="space-y-2">
            {members.filter(m => !isCarpool || m.id !== driver?.id).map((member) => (
              <Link
                key={member.id}
                to={`/users/${member.id}`}
                className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 p-2 rounded-lg transition-colors"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={member.photo || undefined} />
                  <AvatarFallback>
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{member.name}</p>
                    <RatingBadge userId={member.id} size="small" />
                  </div>
                  <p className="text-xs text-muted-foreground">{member.program}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isMember && !isFull && (
            <Button onClick={handleJoinRide} disabled={loading} className="flex-1">
              Join Ride
            </Button>
          )}
          {isMember && (
            <>
              {isDriver ? (
                <Button
                  variant="outline"
                  disabled
                  className="flex-1"
                  title="As the driver, you cannot leave. Delete the ride group instead."
                >
                  Driver Cannot Leave
                </Button>
              ) : (
                <Button
                  onClick={() => setShowLeaveDialog(true)}
                  variant="outline"
                  disabled={loading}
                  className="flex-1"
                >
                  Leave Ride
                </Button>
              )}
              <Button
                onClick={() => setShowVoting(true)}
                variant="outline"
                className="flex-1"
              >
                Vote Meeting Point
              </Button>
              <Button
                onClick={() => {
                  // Mock WhatsApp Group Link
                  // In a real app, this would be fetched from the DB (created via API)
                  const text = `Join my ride to ${event.name} at ${format(new Date(rideGroup.departure_time), 'h:mm a')}!`;
                  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                  window.open(url, '_blank');
                  toast.success("Opening WhatsApp Group...");
                }}
                variant="outline"
                title="Open WhatsApp Group"
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setShowShare(true)}
                variant="outline"
                title="Share ride details"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setShowInvite(true)}
                variant="outline"
                title="Invite others"
              >
                <UserPlus className="w-4 h-4" />
              </Button>
              {rideGroup.travel_mode.includes('Rideshare') && (
                <Button
                  onClick={() => setShowPayment(true)}
                  variant="default"
                >
                  Split Cost
                </Button>
              )}
              <Button
                onClick={() => setShowCompleteDialog(true)}
                variant="secondary"
                title="Manually complete ride and submit attendance"
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>

      {isMember && showVoting && (
        <MeetingPointVoting
          rideId={rideGroup.id}
          currentMeetingPoint={leaderMeetingPoint ?? rideGroup.meeting_point}
          onClose={() => setShowVoting(false)}
          onUpdate={onUpdate}
        />
      )}

      {isMember && showPayment && (
        <UberPaymentDialog
          open={showPayment}
          onOpenChange={setShowPayment}
          rideId={rideGroup.id}
          members={members}
          currentUserId={currentUserId}
        />
      )}

      {isMember && showInvite && (
        <InviteDialog
          open={showInvite}
          onOpenChange={setShowInvite}
          rideId={rideGroup.id}
        />
      )}

      {isMember && (
        <RideGroupChat
          open={showChat}
          onOpenChange={setShowChat}
          rideId={rideGroup.id}
          rideName={`${event.destination} - ${format(new Date(rideGroup.departure_time), 'MMM d, h:mm a')}`}
        />
      )}

      {isMember && (
        <ShareRideDetails
          rideId={rideGroup.id}
          event={event}
          ride={rideGroup}
          members={members}
          driver={driver}
          open={showShare}
          onOpenChange={setShowShare}
        />
      )}

      {showProfileDialog && selectedProfile && (
        <UserProfileDialog
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          userId={selectedProfile}
        />
      )}

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Ride Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this ride group? You can rejoin later if there's still space.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveRide}
              disabled={loading}
            >
              {loading ? "Leaving..." : "Leave"}
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
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRide}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Ride?</AlertDialogTitle>
            <AlertDialogDescription>
              This will open the attendance survey where you can confirm who attended the ride.
              This is typically done automatically 24 hours after the ride, but you can complete it manually now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCompleteDialog(false);
                setShowAttendanceDialog(true);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isMember && (
        <AttendanceSurveyDialog
          open={showAttendanceDialog}
          onOpenChange={setShowAttendanceDialog}
          rideId={rideGroup.id}
          eventName={event.name}
        />
      )}

      <EditRideDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        ride={rideGroup}
        event={event}
        currentMemberCount={rideGroup.ride_members.length}
        onRideUpdated={onUpdate}
      />
    </Card>
  );
};
