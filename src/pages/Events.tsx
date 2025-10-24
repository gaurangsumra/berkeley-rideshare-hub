import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Calendar, Search } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "@/components/Navigation";
import { EventCard } from "@/components/EventCard";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { ImportCalendarDialog } from "@/components/ImportCalendarDialog";
import { debounce } from "@/lib/utils";

interface Event {
  id: string;
  name: string;
  date_time: string;
  destination: string;
  city: string;
  description: string | null;
  created_by: string;
}

const Events = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchEvents();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/auth");
      }
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchEvents = async (searchTerm = "") => {
    try {
      if (searchTerm.trim()) {
        // Use PostgreSQL full-text search
        const { data, error } = await supabase
          .rpc('search_events', { 
            search_query: searchTerm 
          });
        
        if (error) throw error;
        setEvents(data || []);
      } else {
        // No search term - fetch all upcoming events
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .gte('date_time', new Date().toISOString())
          .order('date_time', { ascending: true });

        if (error) throw error;
        setEvents(data || []);
      }
    } catch (error: any) {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  // Debounce search to avoid too many queries
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setLoading(true);
      fetchEvents(query);
    }, 300),
    []
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">Upcoming Events</h1>
              <p className="text-muted-foreground mt-1">Find rides to off-campus events</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setImportDialogOpen(true)} size="lg" variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                Import Calendar
              </Button>
              <Button onClick={() => setCreateDialogOpen(true)} size="lg">
                <Plus className="w-4 h-4 mr-2" />
                Create Event
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search events by name, destination, or city..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                debouncedSearch(e.target.value);
              }}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 && !searchQuery ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No upcoming events yet</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create the first event
            </Button>
          </div>
        ) : events.length === 0 && searchQuery ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No events match your search</p>
            <Button onClick={() => {
              setSearchQuery("");
              fetchEvents();
            }} variant="outline">
              Clear search
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onEventCreated={fetchEvents}
      />

      <ImportCalendarDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onEventsImported={fetchEvents}
      />

      <Navigation />
    </div>
  );
};

export default Events;