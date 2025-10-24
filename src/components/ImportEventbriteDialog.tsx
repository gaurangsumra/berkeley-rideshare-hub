import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface EventbriteEvent {
  eventbrite_id: string;
  name: string;
  date_time: string;
  destination: string;
  city: string;
  description: string | null;
  image_url: string | null;
  url: string | null;
}

interface ImportEventbriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventsImported: () => void;
}

export function ImportEventbriteDialog({ 
  open, 
  onOpenChange, 
  onEventsImported 
}: ImportEventbriteDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<EventbriteEvent[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const handleSearch = async () => {
    if (!location.trim()) {
      toast.error("Please enter a location");
      return;
    }

    setLoading(true);
    setSearchResults([]);
    setSelectedEvents(new Set());

    try {
      const { data, error } = await supabase.functions.invoke('eventbrite-search', {
        body: {
          query: searchQuery.trim(),
          location: location.trim()
        }
      });

      if (error) {
        console.error('Eventbrite search error:', error);
        throw error;
      }

      if (!data || !data.events) {
        throw new Error('Invalid response from Eventbrite');
      }

      setSearchResults(data.events);

      if (data.events.length === 0) {
        toast.info("No in-person events found in the next month. Try a different location or keywords.");
      } else {
        toast.success(`Found ${data.events.length} in-person event${data.events.length !== 1 ? 's' : ''} in the next month!`);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error(error.message || "Failed to search events");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (selectedEvents.size === 0) {
      toast.error("Please select at least one event to import");
      return;
    }

    setImporting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in to import events");
      }

      const eventsToImport = searchResults.filter(e => 
        selectedEvents.has(e.eventbrite_id)
      );

      const { error } = await supabase.from('events').insert(
        eventsToImport.map(event => ({
          name: event.name,
          date_time: event.date_time,
          destination: event.destination,
          city: event.city,
          description: event.description,
          created_by: session.user.id
        }))
      );

      if (error) {
        console.error('Import error:', error);
        throw error;
      }

      toast.success(`Successfully imported ${eventsToImport.length} event${eventsToImport.length !== 1 ? 's' : ''}! 🎉`);
      
      // Reset state
      setSearchQuery('');
      setLocation('');
      setSearchResults([]);
      setSelectedEvents(new Set());
      
      // Close dialog and refresh events
      onOpenChange(false);
      onEventsImported();
      
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || "Failed to import events");
    } finally {
      setImporting(false);
    }
  };

  const toggleEventSelection = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import from Eventbrite</DialogTitle>
          <DialogDescription>
            Search for in-person events happening in the next month
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search for events (e.g., 'tech conference', 'music festival')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearch()}
          />
          
          <Input
            placeholder="Location (e.g., 'San Francisco, CA', 'Berkeley')"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearch()}
          />
          
          <Button 
            onClick={handleSearch} 
            disabled={loading || !location.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              'Search Events'
            )}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <>
            <ScrollArea className="flex-1 mt-4 pr-4">
              <div className="space-y-4">
                {searchResults.map(event => (
                  <Card key={event.eventbrite_id} className="cursor-pointer hover:border-primary/50 transition-colors">
                    <CardContent className="flex gap-4 p-4">
                      <Checkbox
                        checked={selectedEvents.has(event.eventbrite_id)}
                        onCheckedChange={() => toggleEventSelection(event.eventbrite_id)}
                        className="mt-1"
                      />
                      
                      {event.image_url && (
                        <img 
                          src={event.image_url} 
                          className="w-24 h-24 object-cover rounded flex-shrink-0" 
                          alt={event.name}
                        />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg line-clamp-2">{event.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(event.date_time), 'PPP p')}
                        </p>
                        <p className="text-sm mt-1 font-medium">{event.destination}</p>
                        <p className="text-sm text-muted-foreground">{event.city}</p>
                        {event.description && (
                          <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {selectedEvents.size} event{selectedEvents.size !== 1 ? 's' : ''} selected
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={selectedEvents.size === 0 || importing}
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${selectedEvents.size} Event${selectedEvents.size !== 1 ? 's' : ''}`
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
