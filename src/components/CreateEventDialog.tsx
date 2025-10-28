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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    rideshare: true,
    carpool: false,
    maxCapacity: 3,
    minCapacity: 1,
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

    if (!formData.rideshare && !formData.carpool) {
      toast.error("Please select at least one travel option");
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const dateTime = new Date(`${formData.date}T${formData.time}`).toISOString();

      // Create event
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({
          name: formData.name,
          date_time: dateTime,
          destination: formData.destination,
          city: formData.city,
          description: formData.description || null,
          created_by: session.user.id,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Calculate departure time (1 hour before event)
      const eventDateTime = new Date(dateTime);
      const departureTime = new Date(eventDateTime.getTime() - 60 * 60 * 1000).toISOString();
      
      const rideGroupsToCreate = [];

      if (formData.rideshare) {
        rideGroupsToCreate.push({
          event_id: newEvent.id,
          departure_time: departureTime,
          travel_mode: "Rideshare (Uber/Lyft)",
          capacity: 4,
          min_capacity: 1,
          created_by: session.user.id,
        });
      }

      if (formData.carpool) {
        rideGroupsToCreate.push({
          event_id: newEvent.id,
          departure_time: departureTime,
          travel_mode: "Carpool (Student Driver)",
          capacity: formData.maxCapacity + 1,
          min_capacity: formData.minCapacity,
          created_by: session.user.id,
        });
      }

      // Create ride groups
      console.log("Creating ride groups:", rideGroupsToCreate);
      const { data: rideGroups, error: rideError } = await supabase
        .from('ride_groups')
        .insert(rideGroupsToCreate)
        .select();

      if (rideError) {
        console.error("Failed to create ride groups:", rideError);
        toast.error("Event created but failed to create ride groups. You can create them manually.");
        onOpenChange(false);
        onEventCreated();
        return;
      }
      
      console.log("Ride groups created successfully:", rideGroups);

      // Add creator as member to all ride groups
      const memberInserts = rideGroups.map((rg) => ({
        ride_id: rg.id,
        user_id: session.user.id,
        status: 'joined',
        role: rg.travel_mode === 'Carpool (Student Driver)' ? 'driver' : null,
      }));

      console.log("Adding members to ride groups:", memberInserts);
      const { error: memberError } = await supabase
        .from('ride_members')
        .insert(memberInserts);

      if (memberError) {
        console.error("Failed to add members to ride groups:", memberError);
        toast.error("Event and ride groups created, but failed to join. Please join manually.");
      } else {
        console.log("Successfully joined ride groups");
        const message = rideGroups.length > 1 
          ? "Event and ride groups created successfully!" 
          : "Event and ride group created successfully!";
        toast.success(message);
      }

      onOpenChange(false);
      onEventCreated();
      setFormData({
        name: "",
        date: "",
        time: "",
        destination: "",
        city: "",
        description: "",
        rideshare: true,
        carpool: false,
        maxCapacity: 3,
        minCapacity: 1,
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>
            Add a new event and automatically create your ride group
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
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

          <Separator className="my-6" />

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base">Your Ride Preferences *</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You'll be automatically added to a ride group for this event
              </p>
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
                      maxCapacity: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};