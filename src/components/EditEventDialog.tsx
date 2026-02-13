import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Event {
  id: string;
  name: string;
  date_time: string;
  destination: string;
  city: string;
  description: string | null;
}

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  onEventUpdated: () => void;
}

export const EditEventDialog = ({
  open,
  onOpenChange,
  event,
  onEventUpdated,
}: EditEventDialogProps) => {
  const [formData, setFormData] = useState({
    name: event.name,
    destination: event.destination,
    city: event.city,
    description: event.description || "",
  });
  const [eventDate, setEventDate] = useState<Date>(new Date(event.date_time));
  const [eventTime, setEventTime] = useState(format(new Date(event.date_time), "HH:mm"));
  const [loading, setLoading] = useState(false);

  // Reset form when event changes
  useEffect(() => {
    setFormData({
      name: event.name,
      destination: event.destination,
      city: event.city,
      description: event.description || "",
    });
    setEventDate(new Date(event.date_time));
    setEventTime(format(new Date(event.date_time), "HH:mm"));
  }, [event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Event name is required");
      return;
    }

    if (!formData.destination.trim() || !formData.city.trim()) {
      toast.error("Destination and city are required");
      return;
    }

    setLoading(true);

    try {
      const [hours, minutes] = eventTime.split(':');
      const dateTime = new Date(eventDate);
      dateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10));

      const { error } = await supabase
        .from('events')
        .update({
          name: formData.name.trim(),
          destination: formData.destination.trim(),
          city: formData.city.trim(),
          description: formData.description.trim() || null,
          date_time: dateTime.toISOString(),
        })
        .eq('id', event.id);

      if (error) throw error;

      toast.success("Event updated successfully!");
      onOpenChange(false);
      onEventUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to update event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Event Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., SF Giants Game"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !eventDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {eventDate ? format(eventDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={eventDate}
                    onSelect={(date) => date && setEventDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              placeholder="e.g., Oracle Park"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="e.g., San Francisco"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add more details about the event..."
              rows={4}
            />
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
              Update Event
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
