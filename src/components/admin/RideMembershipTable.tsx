import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface RideMembership {
  ride_id: string;
  user_name: string;
  user_email: string;
  user_program: string;
  role: string | null;
  event_name: string;
  event_destination: string;
  departure_time: string;
  travel_mode: string;
  joined_at: string;
}

export const RideMembershipTable = () => {
  const [memberships, setMemberships] = useState<RideMembership[]>([]);
  const [filteredMemberships, setFilteredMemberships] = useState<RideMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchMemberships();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredMemberships(
        memberships.filter(
          (m) =>
            m.user_name.toLowerCase().includes(query) ||
            m.user_email.toLowerCase().includes(query) ||
            m.event_name.toLowerCase().includes(query) ||
            m.event_destination.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredMemberships(memberships);
    }
  }, [searchQuery, memberships]);

  const fetchMemberships = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_members')
        .select(`
          ride_id,
          role,
          created_at,
          profiles!inner(name, email, program),
          ride_groups!inner(
            departure_time,
            travel_mode,
            events!inner(name, destination)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = data?.map((item: any) => ({
        ride_id: item.ride_id,
        user_name: item.profiles.name,
        user_email: item.profiles.email,
        user_program: item.profiles.program,
        role: item.role,
        event_name: item.ride_groups.events.name,
        event_destination: item.ride_groups.events.destination,
        departure_time: item.ride_groups.departure_time,
        travel_mode: item.ride_groups.travel_mode,
        joined_at: item.created_at,
      })) || [];

      setMemberships(formatted);
      setFilteredMemberships(formatted);
    } catch (error: any) {
      console.error("Failed to fetch memberships:", error);
      toast.error("Failed to load ride membership data");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Event', 'Destination', 'Departure Time', 'Travel Mode', 'Member Name', 'Email', 'Program', 'Role', 'Joined'];
    const rows = filteredMemberships.map(m => [
      m.event_name,
      m.event_destination,
      format(new Date(m.departure_time), 'MMM d, yyyy h:mm a'),
      m.travel_mode,
      m.user_name,
      m.user_email,
      m.user_program,
      m.role || 'Member',
      format(new Date(m.joined_at), 'MMM d, yyyy h:mm a')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ride-memberships-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Ride membership data exported successfully");
  };

  if (loading) {
    return <div className="text-center py-8">Loading ride membership data...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Ride Memberships ({filteredMemberships.length})</CardTitle>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMemberships.map((m, idx) => (
                <TableRow key={`${m.ride_id}-${m.user_email}-${idx}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{m.event_name}</p>
                      <p className="text-xs text-muted-foreground">{m.event_destination}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{format(new Date(m.departure_time), 'h:mm a')}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(m.departure_time), 'MMM d')}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{m.user_name}</TableCell>
                  <TableCell>{m.user_email}</TableCell>
                  <TableCell className="text-sm">{m.user_program}</TableCell>
                  <TableCell>
                    <Badge variant={m.role === 'driver' ? 'default' : 'secondary'}>
                      {m.role || 'Member'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
