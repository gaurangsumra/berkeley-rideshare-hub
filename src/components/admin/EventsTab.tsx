import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Download, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface EventRow {
  id: string;
  name: string;
  destination: string;
  date_time: string;
  created_by_name: string;
  ride_count: number;
  attendee_count: number;
}

const chartConfig: ChartConfig = {
  count: { label: "Events", color: "hsl(262, 83%, 58%)" },
};

export const EventsTab = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventRow[]>([]);
  const [destChart, setDestChart] = useState<{ destination: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      setFilteredEvents(events.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.destination.toLowerCase().includes(q) ||
        e.created_by_name.toLowerCase().includes(q)
      ));
    } else {
      setFilteredEvents(events);
    }
  }, [searchQuery, events]);

  const fetchEvents = async () => {
    try {
      const [{ data: eventsData }, { data: rideGroups }, { data: rideMembers }] = await Promise.all([
        supabase.from('events').select('id, name, destination, date_time, created_by, profiles!inner(name)').order('date_time', { ascending: false }),
        supabase.from('ride_groups').select('id, event_id'),
        supabase.from('ride_members').select('ride_id').eq('status', 'joined'),
      ]);

      // Ride count per event
      const rideCountByEvent: Record<string, number> = {};
      const rideIdToEvent: Record<string, string> = {};
      rideGroups?.forEach(r => {
        rideCountByEvent[r.event_id] = (rideCountByEvent[r.event_id] || 0) + 1;
        rideIdToEvent[r.id] = r.event_id;
      });

      // Attendee count per event
      const attendeeCountByEvent: Record<string, Set<string>> = {};
      rideMembers?.forEach(m => {
        const eventId = rideIdToEvent[m.ride_id];
        if (eventId) {
          if (!attendeeCountByEvent[eventId]) attendeeCountByEvent[eventId] = new Set();
          attendeeCountByEvent[eventId].add(m.ride_id); // count memberships
        }
      });

      const rows: EventRow[] = (eventsData || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        destination: e.destination,
        date_time: e.date_time,
        created_by_name: e.profiles?.name || 'Unknown',
        ride_count: rideCountByEvent[e.id] || 0,
        attendee_count: rideMembers?.filter(m => rideIdToEvent[m.ride_id] === e.id).length || 0,
      }));

      setEvents(rows);
      setFilteredEvents(rows);

      // Destination chart (top 10)
      const destCounts: Record<string, number> = {};
      rows.forEach(e => {
        destCounts[e.destination] = (destCounts[e.destination] || 0) + 1;
      });
      const sorted = Object.entries(destCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([destination, count]) => ({ destination, count }));
      setDestChart(sorted);
    } catch (error) {
      toast.error("Failed to load events data");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Destination', 'Date', 'Created By', 'Ride Groups', 'Attendees'];
    const rows = filteredEvents.map(e => [
      e.name, e.destination,
      format(new Date(e.date_time), 'MMM d, yyyy h:mm a'),
      e.created_by_name, e.ride_count, e.attendee_count,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Events exported successfully");
  };

  if (loading) return <div className="text-center py-8">Loading events...</div>;

  return (
    <div className="space-y-6">
      {destChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Destinations</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={destChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="destination" fontSize={11} tickLine={false} width={120} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Events ({filteredEvents.length})</CardTitle>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search events..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Rides</TableHead>
                  <TableHead className="text-right">Attendees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.destination}</TableCell>
                    <TableCell>{format(new Date(e.date_time), 'MMM d, yyyy h:mm a')}</TableCell>
                    <TableCell>{e.created_by_name}</TableCell>
                    <TableCell className="text-right">{e.ride_count}</TableCell>
                    <TableCell className="text-right">{e.attendee_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
