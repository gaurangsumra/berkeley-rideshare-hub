import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RideGroup {
  id: string;
  departure_time: string;
  travel_mode: string;
  meeting_point: string | null;
  capacity: number;
  min_capacity: number;
  created_by: string;
  event_id: string;
}

interface Event {
  id: string;
  name: string;
  destination: string;
  city: string;
}

interface EditRideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ride: RideGroup;
  event: Event;
  currentMemberCount: number;
  onRideUpdated: () => void;
}

export const EditRideDialog = ({
  open,
  onOpenChange,
  ride,
  event,
  currentMemberCount,
  onRideUpdated,
}: EditRideDialogProps) => {
  const [departureDate, setDepartureDate] = useState<Date>(new Date(ride.departure_time));
  const [departureTime, setDepartureTime] = useState(format(new Date(ride.departure_time), "HH:mm"));
  const [meetingPoint, setMeetingPoint] = useState(ride.meeting_point || "");
  const [capacity, setCapacity] = useState(ride.capacity);
  const [minCapacity, setMinCapacity] = useState(ride.min_capacity);
  const [loading, setLoading] = useState(false);

  // Reset form when ride changes
  useEffect(() => {
    setDepartureDate(new Date(ride.departure_time));
    setDepartureTime(format(new Date(ride.departure_time), "HH:mm"));
    setMeetingPoint(ride.meeting_point || "");
    setCapacity(ride.capacity);
    setMinCapacity(ride.min_capacity);
  }, [ride]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (capacity < currentMemberCount) {
      toast.error(`Capacity cannot be less than current member count (${currentMemberCount})`);
      return;
    }

    if (capacity < 1) {
      toast.error("Capacity must be at least 1");
      return;
    }

    if (minCapacity < 1) {
      toast.error("Minimum capacity must be at least 1");
      return;
    }

    if (minCapacity > capacity) {
      toast.error("Minimum capacity cannot exceed maximum capacity");
      return;
    }

    const [hours, minutes] = departureTime.split(':');
    const dateTime = new Date(departureDate);
    dateTime.setHours(parseInt(hours), parseInt(minutes));

    if (dateTime < new Date()) {
      toast.error("Departure time must be in the future");
      return;
    }

    setLoading(true);

    try {
      // Update the ride group
      const { error: updateError } = await supabase
        .from('ride_groups')
        .update({
          departure_time: dateTime.toISOString(),
          meeting_point: meetingPoint.trim() || null,
          capacity,
          min_capacity: minCapacity,
        })
        .eq('id', ride.id);

      if (updateError) throw updateError;

      // Get all ride members to notify them
      const { data: members } = await supabase
        .from('ride_members')
        .select('user_id')
        .eq('ride_id', ride.id)
        .eq('status', 'joined');

      if (members && members.length > 0) {
        // Get current user info
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user?.id)
          .single();

        // Send email notifications
        const memberIds = members.map(m => m.user_id);
        const { data: memberEmails } = await supabase
          .from('profiles')
          .select('email')
          .in('id', memberIds.filter(id => id !== user?.id));

        if (memberEmails && memberEmails.length > 0) {
          await supabase.functions.invoke('send-ride-notification', {
            body: {
              type: 'ride_updated',
              rideId: ride.id,
              recipientEmails: memberEmails.map(m => m.email),
              actorName: profile?.name || 'The organizer',
              eventName: event.name,
              departureTime: dateTime.toISOString(),
              meetingPoint: meetingPoint.trim() || undefined,
              capacity,
            }
          });
        }
      }

      toast.success("Ride updated successfully!");
      onOpenChange(false);
      onRideUpdated();
    } catch (error: any) {
      console.error('Error updating ride:', error);
      toast.error(error.message || "Failed to update ride");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Ride Details</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Travel Mode (Read-only)</Label>
            <Badge variant={ride.travel_mode.includes('Rideshare') ? 'default' : 'secondary'}>
              {ride.travel_mode.includes('Rideshare') ? 'Rideshare (Uber/Lyft)' : 'Carpool (Student Driver)'}
            </Badge>
            <p className="text-xs text-muted-foreground">
              Travel mode cannot be changed after creation
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Departure Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !departureDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {departureDate ? format(departureDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={departureDate}
                    onSelect={(date) => date && setDepartureDate(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Departure Time</Label>
              <Input
                id="time"
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meetingPoint">Meeting Point</Label>
            <Input
              id="meetingPoint"
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
              placeholder="e.g., North Gate, Campanile"
            />
            <p className="text-xs text-muted-foreground">
              Members can also vote on meeting points
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capacity">Max Capacity</Label>
              <Input
                id="capacity"
                type="number"
                min={currentMemberCount}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Current members: {currentMemberCount}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minCapacity">Min Capacity</Label>
              <Input
                id="minCapacity"
                type="number"
                min={1}
                max={capacity}
                value={minCapacity}
                onChange={(e) => setMinCapacity(parseInt(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Ride
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
