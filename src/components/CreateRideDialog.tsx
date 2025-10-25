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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

interface CreateRideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventDate?: string;
  onRideCreated: () => void;
}

export const CreateRideDialog = ({
  open,
  onOpenChange,
  eventId,
  eventDate,
  onRideCreated,
}: CreateRideDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: eventDate ? new Date(eventDate).toISOString().split('T')[0] : "",
    time: eventDate ? new Date(eventDate).toTimeString().slice(0, 5) : "",
    travelMode: "Rideshare (Uber/Lyft)",
  });

  // Update form data when event date changes or dialog opens
  useEffect(() => {
    if (open && eventDate) {
      setFormData({
        date: new Date(eventDate).toISOString().split('T')[0],
        time: new Date(eventDate).toTimeString().slice(0, 5),
        travelMode: "Rideshare (Uber/Lyft)",
      });
    }
  }, [open, eventDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.time) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const departureTime = new Date(`${formData.date}T${formData.time}`).toISOString();

      const { data: rideGroup, error: rideError } = await supabase
        .from('ride_groups')
        .insert({
          event_id: eventId,
          departure_time: departureTime,
          travel_mode: formData.travelMode,
          capacity: 4,
          created_by: session.user.id,
        })
        .select()
        .single();

      if (rideError) throw rideError;

      const role = formData.travelMode === 'Carpool (Student Driver)' ? 'driver' : null;
      
      const { error: memberError } = await supabase
        .from('ride_members')
        .insert({
          ride_id: rideGroup.id,
          user_id: session.user.id,
          status: 'joined',
          role: role,
        });

      if (memberError) throw memberError;

      toast.success("Ride group created successfully!");
      onOpenChange(false);
      onRideCreated();
      setFormData({ date: "", time: "", travelMode: "Rideshare (Uber/Lyft)" });
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
            <Label>Travel Mode *</Label>
            <RadioGroup
              value={formData.travelMode}
              onValueChange={(value) => setFormData({ ...formData, travelMode: value })}
              className="mt-2 space-y-3"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Rideshare (Uber/Lyft)" id="rideshare" />
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
                  <RadioGroupItem value="Carpool (Student Driver)" id="carpool" />
                  <Label htmlFor="carpool" className="font-normal cursor-pointer">
                    Carpool (Student Driver Needed)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {formData.travelMode === 'Carpool (Student Driver)' 
                    ? "✓ You'll be the driver for this ride" 
                    : "You'll drive your car and offer rides"}
                </p>
              </div>
            </RadioGroup>
          </div>

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