import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { debounce } from "@/lib/utils";
import { format } from "date-fns";
import { AlertCircle, ArrowRight } from "lucide-react";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventCreated: () => void;
}

interface Event {
  id: string;
  name: string;
  date_time: string;
  destination: string;
  city: string;
}

export const CreateEventDialog = ({
  open,
  onOpenChange,
  onEventCreated,
}: CreateEventDialogProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [similarEvents, setSimilarEvents] = useState<Event[]>([]);
  const [searchingSimilar, setSearchingSimilar] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    time: "",
    destination: "",
    city: "",
    description: "",
  });

  const searchSimilarEvents = async () => {
    if (formData.name.length < 3 && !formData.destination && !formData.city) {
      setSimilarEvents([]);
      return;
    }

    setSearchingSimilar(true);
    try {
      const searchQuery = `${formData.name} ${formData.destination} ${formData.city}`.trim();
      
      const { data, error } = await supabase
        .rpc('search_events', { search_query: searchQuery });
      
      if (error) throw error;
      
      let filteredData = data || [];
      if (formData.date) {
        const selectedDate = new Date(formData.date);
        filteredData = filteredData.filter((event: Event) => {
          const eventDate = new Date(event.date_time);
          const daysDiff = Math.abs((eventDate.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff <= 7;
        });
      }
      
      setSimilarEvents(filteredData.slice(0, 3));
    } catch (error) {
      console.error('Error searching similar events:', error);
    } finally {
      setSearchingSimilar(false);
    }
  };

  const debouncedSearchSimilar = useCallback(
    debounce(() => searchSimilarEvents(), 500),
    [formData.name, formData.destination, formData.city, formData.date]
  );

  useEffect(() => {
    if (open) {
      debouncedSearchSimilar();
    } else {
      setSimilarEvents([]);
    }
  }, [formData.name, formData.destination, formData.city, formData.date, open]);

  const handleNavigateToEvent = (eventId: string) => {
    onOpenChange(false);
    navigate(`/events/${eventId}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.date || !formData.time || !formData.destination || !formData.city) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const dateTime = new Date(`${formData.date}T${formData.time}`).toISOString();

      const { error } = await supabase.from('events').insert({
        name: formData.name,
        date_time: dateTime,
        destination: formData.destination,
        city: formData.city,
        description: formData.description || null,
        created_by: session.user.id,
      });

      if (error) throw error;

      toast.success("Event created successfully!");
      onOpenChange(false);
      onEventCreated();
      setFormData({
        name: "",
        date: "",
        time: "",
        destination: "",
        city: "",
        description: "",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>
            Add a new event for students to coordinate rides
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Event Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Tech Networking Event"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="time">Time *</Label>
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
            <Label htmlFor="destination">Location Name *</Label>
            <Input
              id="destination"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              placeholder="Tech Hub SF"
              required
            />
          </div>

          <div>
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="San Francisco"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add details about the event..."
              rows={3}
            />
          </div>

          {similarEvents.length > 0 && (
            <div className="border-2 border-amber-500 rounded-lg p-4 bg-amber-50 dark:bg-amber-950/20">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    Similar events found
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Is this what you're looking for?
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                {similarEvents.map((event) => (
                  <Card 
                    key={event.id} 
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleNavigateToEvent(event.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">{event.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(event.date_time), 'PPP p')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {event.destination}, {event.city}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          View Event
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
              {loading ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};