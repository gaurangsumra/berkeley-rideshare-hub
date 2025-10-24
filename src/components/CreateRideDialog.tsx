import { useState } from "react";
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
  onRideCreated: () => void;
}

export const CreateRideDialog = ({
  open,
  onOpenChange,
  eventId,
  onRideCreated,
}: CreateRideDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    travelMode: "Uber",
  });

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

      const { error: memberError } = await supabase
        .from('ride_members')
        .insert({
          ride_id: rideGroup.id,
          user_id: session.user.id,
          status: 'joined',
        });

      if (memberError) throw memberError;

      toast.success("Ride group created successfully!");
      onOpenChange(false);
      onRideCreated();
      setFormData({ date: "", time: "", travelMode: "Uber" });
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
              className="mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Uber" id="uber" />
                <Label htmlFor="uber" className="font-normal cursor-pointer">
                  Uber (Cost will be split)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Self-Driving" id="driving" />
                <Label htmlFor="driving" className="font-normal cursor-pointer">
                  Self-Driving
                </Label>
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