import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { Download, Search, Star } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { UserDetailSheet } from "./UserDetailSheet";

interface UserData {
  id: string;
  name: string;
  email: string;
  program: string;
  photo: string | null;
  venmo_username: string | null;
  created_at: string;
  is_invited_user: boolean;
  invited_via_ride_id: string | null;
  ride_count: number;
  avg_rating: number;
}

type FilterType = "all" | "berkeley" | "invited";

const PIE_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(262, 83%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(180, 70%, 45%)",
  "hsl(320, 70%, 50%)",
  "hsl(45, 93%, 47%)",
];

const pieChartConfig: ChartConfig = {
  count: { label: "Users" },
};

export const UserDataTable = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [programData, setProgramData] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    let result = users;

    if (filter === "berkeley") {
      result = result.filter(u => !u.is_invited_user);
    } else if (filter === "invited") {
      result = result.filter(u => u.is_invited_user);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.program.toLowerCase().includes(q)
      );
    }

    setFilteredUsers(result);
  }, [searchQuery, users, filter]);

  const fetchUsers = async () => {
    try {
      const [{ data: profileData, error }, { data: rideMembers }, { data: ratings }] = await Promise.all([
        supabase.from('profiles').select('id, name, email, program, photo, venmo_username, created_at, is_invited_user, invited_via_ride_id').order('created_at', { ascending: false }),
        supabase.from('ride_members').select('user_id').eq('status', 'joined'),
        supabase.from('user_ratings').select('rated_user_id, rating'),
      ]);

      if (error) throw error;

      // Ride counts per user
      const rideCounts: Record<string, number> = {};
      rideMembers?.forEach(m => {
        rideCounts[m.user_id] = (rideCounts[m.user_id] || 0) + 1;
      });

      // Avg ratings per user
      const ratingMap: Record<string, { total: number; count: number }> = {};
      ratings?.forEach(r => {
        if (r.rating === null) return;
        if (!ratingMap[r.rated_user_id]) ratingMap[r.rated_user_id] = { total: 0, count: 0 };
        ratingMap[r.rated_user_id].total += r.rating;
        ratingMap[r.rated_user_id].count++;
      });

      const enriched: UserData[] = (profileData || []).map(p => ({
        ...p,
        program: p.program || '',
        is_invited_user: p.is_invited_user || false,
        ride_count: rideCounts[p.id] || 0,
        avg_rating: ratingMap[p.id] ? Math.round((ratingMap[p.id].total / ratingMap[p.id].count) * 10) / 10 : 0,
      }));

      setUsers(enriched);
      setFilteredUsers(enriched);

      // Program distribution
      const programs: Record<string, number> = {};
      enriched.forEach(u => {
        const prog = u.program || 'Unknown';
        programs[prog] = (programs[prog] || 0) + 1;
      });
      const sorted = Object.entries(programs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value }));
      setProgramData(sorted);
    } catch (error) {
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Program', 'Account Created', 'Type', 'Rides', 'Avg Rating'];
    const rows = filteredUsers.map(user => [
      user.name, user.email, user.program,
      format(new Date(user.created_at), 'MMM d, yyyy h:mm a'),
      user.is_invited_user ? 'Invited' : 'Berkeley',
      user.ride_count,
      user.avg_rating || 'N/A',
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("User data exported successfully");
  };

  if (loading) return <div className="text-center py-8">Loading user data...</div>;

  return (
    <div className="space-y-6">
      {programData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Program Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ChartContainer config={pieChartConfig} className="h-[220px] w-[320px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie data={programData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false} fontSize={10}>
                    {programData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
          <div className="flex items-center justify-between">
            <CardTitle>User Data ({filteredUsers.length})</CardTitle>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            {(["all", "berkeley", "invited"] as FilterType[]).map((f) => (
              <Badge
                key={f}
                variant={filter === f ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "berkeley" ? "Berkeley" : "Invited"}
              </Badge>
            ))}
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, email, or program..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Rides</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setSelectedUser(user); setSheetOpen(true); }}
                  >
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.program}</TableCell>
                    <TableCell>{format(new Date(user.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_invited_user ? "secondary" : "default"}>
                        {user.is_invited_user ? 'Invited' : 'Berkeley'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{user.ride_count}</TableCell>
                    <TableCell className="text-right">
                      {user.avg_rating > 0 ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {user.avg_rating}
                        </span>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UserDetailSheet user={selectedUser} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
};
