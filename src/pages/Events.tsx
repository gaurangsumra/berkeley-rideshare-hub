import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Calendar as CalendarIcon, Search, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "@/components/Navigation";
import { EventCard } from "@/components/EventCard";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { ImportCalendarDialog } from "@/components/ImportCalendarDialog";
import { debounce } from "@/lib/utils";
import { useUserAuthorization } from "@/hooks/useUserAuthorization";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

interface Event {
  id: string;
  name: string;
  date_time: string;
  destination: string;
  city: string;
  description: string | null;
  created_by: string;
  ride_group_count?: number;
  member_count?: number;
}

const Events = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const { isExternalUser, isLoading: authLoading } = useUserAuthorization();

  // Redirect external users
  useEffect(() => {
    if (authLoading) return;
    
    if (isExternalUser) {
      toast.error("You don't have access to browse events. You can only see rides you've been invited to.");
      navigate('/my-rides');
    }
  }, [isExternalUser, authLoading, navigate]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user has completed onboarding
      const { data: profileData } = await supabase
        .from('profiles')
        .select('photo')
        .eq('id', session.user.id)
        .single();

      if (!profileData?.photo) {
        navigate("/onboarding");
        return;
      }

      setUser(session.user);
      fetchEvents();
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
        
        // Fetch counts separately for search results
        const eventIds = data?.map(e => e.id) || [];
        if (eventIds.length > 0) {
          const { data: rideGroups } = await supabase
            .from('ride_groups')
            .select('event_id, ride_members(count)')
            .in('event_id', eventIds);
          
          const groupCountMap: Record<string, number> = {};
          const memberCountMap: Record<string, number> = {};
          
          rideGroups?.forEach(rg => {
            groupCountMap[rg.event_id] = (groupCountMap[rg.event_id] || 0) + 1;
            memberCountMap[rg.event_id] = (memberCountMap[rg.event_id] || 0) + (rg.ride_members?.[0]?.count || 0);
          });
          
          const eventsWithCounts = data?.map(e => ({
            ...e,
            ride_group_count: groupCountMap[e.id] || 0,
            member_count: memberCountMap[e.id] || 0
          })) || [];
          
          setEvents(eventsWithCounts);
        } else {
          setEvents([]);
        }
      } else {
        // No search term - fetch all events with ride group counts
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('date_time', { ascending: true });

        if (error) throw error;
        
        // Fetch counts for all events
        const eventIds = data?.map(e => e.id) || [];
        if (eventIds.length > 0) {
          const { data: rideGroups } = await supabase
            .from('ride_groups')
            .select('event_id, ride_members(count)')
            .in('event_id', eventIds);
          
          const groupCountMap: Record<string, number> = {};
          const memberCountMap: Record<string, number> = {};
          
          rideGroups?.forEach(rg => {
            groupCountMap[rg.event_id] = (groupCountMap[rg.event_id] || 0) + 1;
            memberCountMap[rg.event_id] = (memberCountMap[rg.event_id] || 0) + (rg.ride_members?.[0]?.count || 0);
          });
          
          const eventsWithCounts = data?.map(e => ({
            ...e,
            ride_group_count: groupCountMap[e.id] || 0,
            member_count: memberCountMap[e.id] || 0
          })) || [];
          
          setEvents(eventsWithCounts);
        } else {
          setEvents([]);
        }
      }
    } catch (error: any) {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const fetchEventsByDate = async (date: Date) => {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('date_time', startOfDay.toISOString())
        .lte('date_time', endOfDay.toISOString())
        .order('date_time', { ascending: true });

      if (error) throw error;
      
      // Fetch counts
      const eventIds = data?.map(e => e.id) || [];
      if (eventIds.length > 0) {
        const { data: rideGroups } = await supabase
          .from('ride_groups')
          .select('event_id, ride_members(count)')
          .in('event_id', eventIds);
        
        const groupCountMap: Record<string, number> = {};
        const memberCountMap: Record<string, number> = {};
        
        rideGroups?.forEach(rg => {
          groupCountMap[rg.event_id] = (groupCountMap[rg.event_id] || 0) + 1;
          memberCountMap[rg.event_id] = (memberCountMap[rg.event_id] || 0) + (rg.ride_members?.[0]?.count || 0);
        });
        
        const eventsWithCounts = data?.map(e => ({
          ...e,
          ride_group_count: groupCountMap[e.id] || 0,
          member_count: memberCountMap[e.id] || 0
        })) || [];
        
        setEvents(eventsWithCounts);
      } else {
        setEvents([]);
      }
    } catch (error: any) {
      toast.error("Failed to filter events by date");
    } finally {
      setLoading(false);
    }
  };

  const groupEventsByDate = (events: Event[]) => {
    const now = new Date();
    const upcomingEvents = events.filter(e => new Date(e.date_time) >= now);
    const pastEvents = events.filter(e => new Date(e.date_time) < now);
    
    const sortedEvents = [...upcomingEvents, ...pastEvents];
    
    const grouped = sortedEvents.reduce((acc, event) => {
      const dateKey = format(new Date(event.date_time), 'EEEE, MMMM d, yyyy');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(event);
      return acc;
    }, {} as Record<string, Event[]>);
    
    return Object.entries(grouped);
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
          {/* Title always on top */}
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold text-primary">Upcoming Events</h1>
            <p className="text-muted-foreground mt-1">Find rides to off-campus events</p>
          </div>
          
          {/* Search, date filter, and create button on same row below title */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search events by name, destination, or city..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setDateFilter(undefined);
                  debouncedSearch(e.target.value);
                }}
                className="pl-10"
              />
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilter ? format(dateFilter, "MMM dd, yyyy") : "Filter by date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateFilter}
                  onSelect={(date) => {
                    setDateFilter(date);
                    setSearchQuery("");
                    if (date) {
                      setLoading(true);
                      fetchEventsByDate(date);
                    } else {
                      setLoading(true);
                      fetchEvents();
                    }
                  }}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Event
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Import Calendar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Event Manually
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 && !searchQuery ? (
          <div className="text-center py-12 space-y-4">
            <div className="text-6xl mb-4">🎫</div>
            <div>
              <p className="font-medium text-lg mb-2">No Events Available</p>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                You don't have access to any events yet. Berkeley students can create events, 
                or join rides you've been invited to.
              </p>
            </div>
          </div>
        ) : events.length === 0 && (searchQuery || dateFilter) ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "No events match your search" : "No events on this date"}
            </p>
            <Button onClick={() => {
              setSearchQuery("");
              setDateFilter(undefined);
              setLoading(true);
              fetchEvents();
            }} variant="outline">
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupEventsByDate(events).map(([date, dateEvents]) => (
              <div key={date} className="space-y-3">
                <h2 className="text-lg font-semibold text-primary border-b pb-2">
                  {date}
                </h2>
                <div className="space-y-3">
                  {dateEvents.map((event) => {
                    const isPastEvent = new Date(event.date_time) < new Date();
                    return <EventCard key={event.id} event={event} isPastEvent={isPastEvent} />;
                  })}
                </div>
              </div>
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