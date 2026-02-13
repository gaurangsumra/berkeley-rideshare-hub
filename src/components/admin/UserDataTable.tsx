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

interface UserData {
  id: string;
  name: string;
  email: string;
  program: string;
  created_at: string;
  is_invited_user: boolean;
  invited_via_ride_id: string | null;
}

export const UserDataTable = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query) ||
            user.program.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, program, created_at, is_invited_user, invited_via_ride_id')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error: any) {
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Program', 'Account Created', 'Invited User', 'Invited Via Ride'];
    const rows = filteredUsers.map(user => [
      user.name,
      user.email,
      user.program,
      format(new Date(user.created_at), 'MMM d, yyyy h:mm a'),
      user.is_invited_user ? 'Yes' : 'No',
      user.invited_via_ride_id || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("User data exported successfully");
  };

  if (loading) {
    return <div className="text-center py-8">Loading user data...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>User Data ({filteredUsers.length})</CardTitle>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or program..."
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
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.program}</TableCell>
                  <TableCell>{format(new Date(user.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_invited_user ? "secondary" : "default"}>
                      {user.is_invited_user ? 'Invited' : 'Berkeley'}
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
