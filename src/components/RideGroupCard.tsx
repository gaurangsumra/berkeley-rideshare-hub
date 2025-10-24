import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, Users, MapPin } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { MeetingPointVoting } from "@/components/MeetingPointVoting";
import { UberPaymentDialog } from "@/components/UberPaymentDialog";

interface RideGroup {
  id: string;
  departure_time: string;
  travel_mode: string;
  meeting_point: string | null;
  capacity: number;
  ride_members: { user_id: string }[];
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
}

export const RideGroupCard = ({ rideGroup, currentUserId, onUpdate }: RideGroupCardProps) => {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showVoting, setShowVoting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const isMember = currentUserId && rideGroup.ride_members.some(m => m.user_id === currentUserId);
  const isFull = rideGroup.ride_members.length >= rideGroup.capacity;

  useEffect(() => {
    fetchMembers();
  }, [rideGroup.id]);

  const fetchMembers = async () => {
    try {
      const memberIds = rideGroup.ride_members.map(m => m.user_id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', memberIds);

      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      console.error("Failed to load members:", error);
    }
  };

  const handleJoinRide = async () => {
    if (!currentUserId) return;
    
    try {
      setLoading(true);
      const { error } = await supabase.from('ride_members').insert({
        ride_id: rideGroup.id,
        user_id: currentUserId,
        status: 'joined',
      });

      if (error) throw error;
      toast.success("Joined ride group!");
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {format(new Date(rideGroup.departure_time), 'h:mm a')}
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant={rideGroup.travel_mode === 'Uber' ? 'default' : 'secondary'}>
              {rideGroup.travel_mode}
            </Badge>
            <Badge variant="outline">
              <Users className="w-3 h-3 mr-1" />
              {rideGroup.ride_members.length}/{rideGroup.capacity}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {rideGroup.meeting_point && (
          <div className="flex items-center gap-2 text-sm text-primary font-medium p-3 bg-primary/5 rounded-lg">
            <MapPin className="w-4 h-4" />
            <span>Meeting Point: {rideGroup.meeting_point}</span>
          </div>
        )}

        <div>
          <p className="text-sm font-medium mb-2">Members:</p>
          <div className="space-y-2">
            {members.map((member) => (
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
              <Button
                onClick={handleLeaveRide}
                variant="outline"
                disabled={loading}
                className="flex-1"
              >
                Leave Ride
              </Button>
              <Button
                onClick={() => setShowVoting(true)}
                variant="secondary"
                className="flex-1"
              >
                Vote Meeting Point
              </Button>
              {rideGroup.travel_mode === 'Uber' && (
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
          currentMeetingPoint={rideGroup.meeting_point}
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
    </Card>
  );
};