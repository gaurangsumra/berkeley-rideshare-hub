import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RideNotificationStat {
  ride_id: string;
  event_name: string;
  departure_time: string;
  message_count: number;
  email_count: number;
  success_rate: number;
  last_sent: string | null;
}

export const RideNotificationStats = () => {
  const [stats, setStats] = useState<RideNotificationStat[]>([]);
  const [filteredStats, setFilteredStats] = useState<RideNotificationStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = stats.filter(stat =>
        stat.event_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStats(filtered);
    } else {
      setFilteredStats(stats);
    }
  }, [searchQuery, stats]);

  const fetchStats = async () => {
    try {
      // Get all rides with their events
      const { data: rides } = await supabase
        .from('ride_groups')
        .select(`
          id,
          departure_time,
          events (
            name
          )
        `);

      if (!rides) return;

      // Get message counts per ride
      const { data: messageCounts } = await supabase
        .from('ride_group_messages')
        .select('ride_id');

      // Get email notification logs per ride
      const { data: emailLogs } = await supabase
        .from('email_notification_logs')
        .select('ride_id, success, sent_at')
        .eq('notification_type', 'new_chat_message');

      // Process the data
      const statsMap = new Map<string, RideNotificationStat>();

      rides.forEach((ride) => {
        const event = ride.events as unknown as { name: string } | null;
        const messageCount = messageCounts?.filter(m => m.ride_id === ride.id).length || 0;
        const rideEmails = emailLogs?.filter(e => e.ride_id === ride.id) || [];
        const emailCount = rideEmails.length;
        const successCount = rideEmails.filter(e => e.success).length;
        const successRate = emailCount > 0 ? Math.round((successCount / emailCount) * 100) : 0;
        const lastSent = rideEmails.length > 0 
          ? rideEmails.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0].sent_at
          : null;

        statsMap.set(ride.id, {
          ride_id: ride.id,
          event_name: event?.name || "Unknown Event",
          departure_time: ride.departure_time,
          message_count: messageCount,
          email_count: emailCount,
          success_rate: successRate,
          last_sent: lastSent,
        });
      });

      const statsArray = Array.from(statsMap.values())
        .sort((a, b) => {
          if (!b.last_sent) return -1;
          if (!a.last_sent) return 1;
          return new Date(b.last_sent).getTime() - new Date(a.last_sent).getTime();
        });

      setStats(statsArray);
      setFilteredStats(statsArray);
    } catch (error) {
      // Failed to fetch notification stats
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Event Name", "Departure", "Messages", "Emails Sent", "Success Rate", "Last Sent"];
    const rows = filteredStats.map(stat => [
      stat.event_name,
      new Date(stat.departure_time).toLocaleString(),
      stat.message_count,
      stat.email_count,
      `${stat.success_rate}%`,
      stat.last_sent ? new Date(stat.last_sent).toLocaleString() : "Never"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ride-notifications-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="text-center py-8">Loading notification statistics...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Ride Email Notifications</span>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </CardTitle>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by event name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Name</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead className="text-right">Emails Sent</TableHead>
                <TableHead className="text-right">Success Rate</TableHead>
                <TableHead>Last Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No notification data found
                  </TableCell>
                </TableRow>
              ) : (
                filteredStats.map((stat) => (
                  <TableRow key={stat.ride_id}>
                    <TableCell className="font-medium">{stat.event_name}</TableCell>
                    <TableCell>
                      {new Date(stat.departure_time).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-right">{stat.message_count}</TableCell>
                    <TableCell className="text-right">{stat.email_count}</TableCell>
                    <TableCell className="text-right">
                      <span className={stat.success_rate === 100 ? "text-green-600" : stat.success_rate >= 80 ? "text-yellow-600" : "text-red-600"}>
                        {stat.success_rate}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {stat.last_sent 
                        ? formatDistanceToNow(new Date(stat.last_sent), { addSuffix: true })
                        : "Never"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
