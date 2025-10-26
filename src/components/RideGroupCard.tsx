import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, Users, MapPin, UserPlus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { MeetingPointVoting } from "@/components/MeetingPointVoting";
import { UberPaymentDialog } from "@/components/UberPaymentDialog";
import { InviteDialog } from "@/components/InviteDialog";
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
}

export const RideGroupCard = ({ rideGroup, currentUserId, onUpdate, isAdmin }: RideGroupCardProps) => {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showVoting, setShowVoting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [leaderMeetingPoint, setLeaderMeetingPoint] = useState<string | null>(null);

  const isMember = currentUserId && rideGroup.ride_members.some(m => m.user_id === currentUserId);
  const isDriver = currentUserId && rideGroup.ride_members.some(m => m.user_id === currentUserId && m.role === 'driver');
  const isFull = rideGroup.ride_members.length >= rideGroup.capacity;
  const canDeleteRide = rideGroup.ride_members.length <= 1 && (isAdmin || isMember);
  const driver = members.find(m => 
    rideGroup.ride_members.find(rm => rm.user_id === m.id && rm.role === 'driver')
  );
  const isCarpool = rideGroup.travel_mode === 'Carpool (Student Driver)';
  const passengerCount = rideGroup.ride_members.filter(m => m.role !== 'driver').length;

  useEffect(() => {
    fetchMembers();
  }, [rideGroup.id]);

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

  // Auto-prompt for Uber payment 1 hour before departure
  useEffect(() => {
    if (!isMember || !rideGroup.travel_mode.includes('Rideshare')) return;
    
    const checkTime = () => {
      const departureTime = new Date(rideGroup.departure_time);
      const currentTime = new Date();
      const oneHourBefore = new Date(departureTime.getTime() - 60 * 60 * 1000);
      const fiveMinutesAfter = new Date(oneHourBefore.getTime() + 5 * 60 * 1000);
      
      // Check if current time is within 1 hour before window (with 5-min buffer)
      if (currentTime >= oneHourBefore && currentTime <= fiveMinutesAfter) {
        const alreadyPrompted = localStorage.getItem(`uber-prompt-${rideGroup.id}`);
        if (!alreadyPrompted) {
          setShowPayment(true);
          localStorage.setItem(`uber-prompt-${rideGroup.id}`, 'true');
          toast.info("It's almost time for your ride! Let's coordinate payment.");
        }
      }
    };
    
    checkTime(); // Check immediately
    const interval = setInterval(checkTime, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [rideGroup.id, rideGroup.departure_time, rideGroup.travel_mode, isMember]);

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
      console.error("Failed to load members:", error);
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
      
      console.log('Vote counts:', counts);
      
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
      console.log('Winners with max votes:', winners, 'Result:', result);
      setLeaderMeetingPoint(result);
    } catch (e) {
      console.error('Failed to fetch leader meeting point', e);
    }
  };

  const handleJoinRide = async () => {
    if (!currentUserId) return;
    
    try {
      setLoading(true);
      const role = isCarpool ? 'rider' : null;
      
      const { error } = await supabase.from('ride_members').insert({
        ride_id: rideGroup.id,
        user_id: currentUserId,
        status: 'joined',
        role: role,
      });

      if (error) throw error;
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
      const { error } = await supabase
        .from('ride_members')
        .delete()
        .eq('ride_id', rideGroup.id)
        .eq('user_id', currentUserId);

      if (error) throw error;
      toast.success("Left ride group");
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
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {format(new Date(rideGroup.departure_time), 'h:mm a')}
          </CardTitle>
          <div className="flex gap-2 items-center">
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
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={member.photo || undefined} />
                  <AvatarFallback>
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.program}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
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
                  onClick={handleLeaveRide}
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
                onClick={() => setShowInvite(true)}
                variant="outline"
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
    </Card>
  );
};
