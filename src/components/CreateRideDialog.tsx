import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface CreateRideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventDate?: string;
  onRideCreated: () => void;
  initialInvitees?: string[];
}

const calculateDefaultTime = (eventDate: string): string => {
  const eventDateTime = new Date(eventDate);
  // Subtract 1 hour (3600000 milliseconds)
  const departureTime = new Date(eventDateTime.getTime() - 60 * 60 * 1000);
  // Format as HH:MM for input[type="time"]
  return departureTime.toTimeString().slice(0, 5);
};

export const CreateRideDialog = ({
  open,
  onOpenChange,
  eventId,
  eventDate,
  onRideCreated,
  initialInvitees,
}: CreateRideDialogProps) => {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    date: eventDate ? new Date(eventDate).toISOString().split('T')[0] : "",
    time: eventDate ? calculateDefaultTime(eventDate) : "",
    rideshare: false,
    carpool: false,
    rideshareCapacity: 4,
    maxCapacity: 3,
    minCapacity: 1,
  });

  // Update form data when event date changes or dialog opens
  useEffect(() => {
    if (open && eventDate) {
      setFormData({
        date: new Date(eventDate).toISOString().split('T')[0],
        time: calculateDefaultTime(eventDate),
        rideshare: false,
        carpool: false,
        rideshareCapacity: 4,
        maxCapacity: 3,
        minCapacity: 1,
      });
    }
  }, [open, eventDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.time) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!formData.rideshare && !formData.carpool) {
      toast.error("Please select at least one travel option");
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const departureTime = new Date(`${formData.date}T${formData.time}`).toISOString();
      const rideGroupsToCreate = [];

      if (formData.rideshare) {
        rideGroupsToCreate.push({
          event_id: eventId,
          departure_time: departureTime,
          travel_mode: "Rideshare (Uber/Lyft)",
          capacity: formData.rideshareCapacity,
          min_capacity: 1,
          created_by: session.user.id,
        });
      }

      if (formData.carpool) {
        rideGroupsToCreate.push({
          event_id: eventId,
          departure_time: departureTime,
          travel_mode: "Carpool (Student Driver)",
          capacity: formData.maxCapacity + 1,
          min_capacity: formData.minCapacity,
          created_by: session.user.id,
        });
      }

      const { data: rideGroups, error: rideError } = await supabase
        .from('ride_groups')
        .insert(rideGroupsToCreate)
        .select();

      if (rideError) throw rideError;

      // Add user as member to all created ride groups
      const memberInserts = rideGroups.map((rg) => ({
        ride_id: rg.id,
        user_id: session.user.id,
        status: 'joined',
        role: rg.travel_mode === 'Carpool (Student Driver)' ? 'driver' : null,
      }));

      // Add initial invitees
      if (initialInvitees && initialInvitees.length > 0) {
        rideGroups.forEach(rg => {
          initialInvitees.forEach(inviteeId => {
            memberInserts.push({
              ride_id: rg.id,
              user_id: inviteeId,
              status: 'invited',
              role: null
            });
          });
        });
      }

      const { error: memberError } = await supabase
        .from('ride_members')
        .insert(memberInserts);

      if (memberError) throw memberError;

      // Send notifications to invitees
      if (initialInvitees && initialInvitees.length > 0) {
        // We can do this async without awaiting to speed up UI
        rideGroups.forEach(rg => {
          initialInvitees.forEach(async (inviteeId) => {
            await supabase.from('notifications').insert({
              user_id: inviteeId,
              ride_id: rg.id,
              type: 'ride_invite',
              title: 'Ride Invitation',
              message: `You have been invited to a ride group for this event.`
            });
          });
        });
      }

      const message = rideGroups.length > 1
        ? "Ride groups created successfully!"
        : "Ride group created successfully!";
      toast.success(message);

      onOpenChange(false);
      onRideCreated();
      setFormData({
        date: "",
        time: "",
        rideshare: false,
        carpool: false,
        rideshareCapacity: 4,
        maxCapacity: 3,
        minCapacity: 1,
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create ride group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Create Ride Group</DialogTitle>
          <DialogDescription>
            Set up a new ride group for this event
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Departure Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="time">Departure Time *</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label>Travel Options * (select at least one)</Label>
            <div className="mt-2 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rideshare"
                    checked={formData.rideshare}
                    onCheckedChange={(checked) => setFormData({ ...formData, rideshare: checked as boolean })}
                  />
                  <Label htmlFor="rideshare" className="font-normal cursor-pointer">
                    Rideshare (Splitting an Uber/Lyft)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  No car needed - split the cost with the group
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="carpool"
                    checked={formData.carpool}
                    onCheckedChange={(checked) => setFormData({ ...formData, carpool: checked as boolean })}
                  />
                  <Label htmlFor="carpool" className="font-normal cursor-pointer">
                    Carpool (Student Driver)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {formData.carpool
                    ? "✓ You'll be the driver for this ride"
                    : "You'll drive your car and offer rides"}
                </p>
              </div>
            </div>
          </div>

          {formData.rideshare && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <Label htmlFor="rideshareCapacity">Rideshare Capacity</Label>
              <Input
                id="rideshareCapacity"
                type="number"
                min="1"
                value={formData.rideshareCapacity}
                onChange={(e) => setFormData({
                  ...formData,
                  rideshareCapacity: Math.max(1, parseInt(e.target.value) || 1)
                })}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground">
                How many people can join this rideshare
              </p>
            </div>
          )}

          {formData.carpool && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="maxCapacity">Maximum Passengers (excluding driver)</Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  min="1"
                  value={formData.maxCapacity}
                  onChange={(e) => setFormData({
                    ...formData,
                    maxCapacity: Math.max(1, parseInt(e.target.value) || 1),
                    minCapacity: Math.min(formData.minCapacity, parseInt(e.target.value) || 1)
                  })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="minCapacity">Minimum Passengers Needed</Label>
                <Input
                  id="minCapacity"
                  type="number"
                  min="1"
                  max={formData.maxCapacity}
                  value={formData.minCapacity}
                  onChange={(e) => setFormData({
                    ...formData,
                    minCapacity: Math.max(1, Math.min(formData.maxCapacity, parseInt(e.target.value) || 1))
                  })}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Need at least {formData.minCapacity} passenger{formData.minCapacity > 1 ? 's' : ''}, max {formData.maxCapacity}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Ride Group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};