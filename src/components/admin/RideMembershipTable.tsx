import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Download, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface RideGroupRow {
  ride_id: string;
  event_name: string;
  event_destination: string;
  departure_time: string;
  travel_mode: string;
  capacity: number | null;
  member_count: number;
  message_count: number;
  status: "Upcoming" | "Completed" | "Past";
}

type StatusFilter = "all" | "upcoming" | "completed" | "past";
type ModeFilter = "all" | string;

const DONUT_COLORS = [
  "hsl(0, 0%, 15%)",
  "hsl(300, 80%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(221, 83%, 53%)",
];

const donutConfig: ChartConfig = {
  count: { label: "Rides" },
};

const capacityConfig: ChartConfig = {
  count: { label: "Rides", color: "hsl(221, 83%, 53%)" },
};

export const RideMembershipTable = () => {
  const [rides, setRides] = useState<RideGroupRow[]>([]);
  const [filteredRides, setFilteredRides] = useState<RideGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [modeData, setModeData] = useState<{ name: string; value: number }[]>([]);
  const [capacityData, setCapacityData] = useState<{ range: string; count: number }[]>([]);
  const [travelModes, setTravelModes] = useState<string[]>([]);

  useEffect(() => {
    fetchRides();
  }, []);

  useEffect(() => {
    let result = rides;

    if (statusFilter !== "all") {
      result = result.filter(r => r.status.toLowerCase() === statusFilter);
    }
    if (modeFilter !== "all") {
      result = result.filter(r => r.travel_mode.toLowerCase() === modeFilter.toLowerCase());
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.event_name.toLowerCase().includes(q) ||
        r.event_destination.toLowerCase().includes(q)
      );
    }

    setFilteredRides(result);
  }, [searchQuery, rides, statusFilter, modeFilter]);

  const fetchRides = async () => {
    try {
      const [{ data: rideGroups }, { data: members }, { data: messages }, { data: completions }] = await Promise.all([
        supabase.from('ride_groups').select('id, departure_time, travel_mode, capacity, events!inner(name, destination)').order('departure_time', { ascending: false }),
        supabase.from('ride_members').select('ride_id').eq('status', 'joined'),
        supabase.from('ride_group_messages').select('ride_id'),
        supabase.from('ride_completions').select('ride_id'),
      ]);

      const memberCounts: Record<string, number> = {};
      members?.forEach(m => { memberCounts[m.ride_id] = (memberCounts[m.ride_id] || 0) + 1; });

      const messageCounts: Record<string, number> = {};
      messages?.forEach(m => { messageCounts[m.ride_id] = (messageCounts[m.ride_id] || 0) + 1; });

      const completedRideIds = new Set(completions?.map(c => c.ride_id) || []);
      const now = new Date();

      const rows: RideGroupRow[] = (rideGroups || []).map((r: any) => {
        const isPast = new Date(r.departure_time) < now;
        let status: "Upcoming" | "Completed" | "Past";
        if (completedRideIds.has(r.id)) status = "Completed";
        else if (isPast) status = "Past";
        else status = "Upcoming";

        return {
          ride_id: r.id,
          event_name: r.events?.name || 'Unknown',
          event_destination: r.events?.destination || '',
          departure_time: r.departure_time,
          travel_mode: r.travel_mode,
          capacity: r.capacity,
          member_count: memberCounts[r.id] || 0,
          message_count: messageCounts[r.id] || 0,
          status,
        };
      });

      setRides(rows);
      setFilteredRides(rows);

      // Travel mode distribution
      const modes: Record<string, number> = {};
      rows.forEach(r => {
        modes[r.travel_mode] = (modes[r.travel_mode] || 0) + 1;
      });
      setModeData(Object.entries(modes).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })));
      setTravelModes(Object.keys(modes));

      // Capacity utilization
      const bins: Record<string, number> = { '0%': 0, '1-25%': 0, '26-50%': 0, '51-75%': 0, '76-100%': 0, '100%+': 0 };
      rows.forEach(r => {
        if (!r.capacity || r.capacity <= 0) return;
        const pct = (r.member_count / r.capacity) * 100;
        if (pct === 0) bins['0%']++;
        else if (pct <= 25) bins['1-25%']++;
        else if (pct <= 50) bins['26-50%']++;
        else if (pct <= 75) bins['51-75%']++;
        else if (pct <= 100) bins['76-100%']++;
        else bins['100%+']++;
      });
      setCapacityData(Object.entries(bins).map(([range, count]) => ({ range, count })));
    } catch (error) {
      toast.error("Failed to load ride data");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Event', 'Destination', 'Departure', 'Travel Mode', 'Members', 'Capacity', 'Messages', 'Status'];
    const rows = filteredRides.map(r => [
      r.event_name, r.event_destination,
      format(new Date(r.departure_time), 'MMM d, yyyy h:mm a'),
      r.travel_mode, r.member_count, r.capacity || 'N/A', r.message_count, r.status,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rides-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Ride data exported successfully");
  };

  if (loading) return <div className="text-center py-8">Loading ride data...</div>;

  const statusBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
    Upcoming: "default",
    Completed: "outline",
    Past: "secondary",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {modeData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Travel Mode Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <ChartContainer config={donutConfig} className="h-[220px] w-[300px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    <Pie data={modeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false} fontSize={10}>
                      {modeData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capacity Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={capacityConfig} className="h-[220px] w-full">
              <BarChart data={capacityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" fontSize={11} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ride Groups ({filteredRides.length})</CardTitle>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-xs text-muted-foreground mr-1">Status:</span>
            {(["all", "upcoming", "completed", "past"] as StatusFilter[]).map((f) => (
              <Badge key={f} variant={statusFilter === f ? "default" : "outline"} className="cursor-pointer" onClick={() => setStatusFilter(f)}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Badge>
            ))}
            <span className="text-xs text-muted-foreground ml-3 mr-1">Mode:</span>
            <Badge variant={modeFilter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setModeFilter("all")}>All</Badge>
            {travelModes.map(m => (
              <Badge key={m} variant={modeFilter === m ? "default" : "outline"} className="cursor-pointer" onClick={() => setModeFilter(m)}>{m}</Badge>
            ))}
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by event name or destination..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Filled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRides.map((r) => (
                  <TableRow key={r.ride_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{r.event_name}</p>
                        <p className="text-xs text-muted-foreground">{r.event_destination}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{format(new Date(r.departure_time), 'h:mm a')}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(r.departure_time), 'MMM d')}</p>
                      </div>
                    </TableCell>
                    <TableCell>{r.travel_mode}</TableCell>
                    <TableCell className="text-right">
                      {r.member_count}{r.capacity ? `/${r.capacity}` : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant[r.status]}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.message_count}</TableCell>
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
