import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Car, Calendar, TrendingUp } from "lucide-react";

interface Analytics {
  totalUsers: number;
  berkeleyUsers: number;
  invitedUsers: number;
  totalRides: number;
  totalEvents: number;
  avgRideSize: number;
}

export const AnalyticsSummary = () => {
  const [analytics, setAnalytics] = useState<Analytics>({
    totalUsers: 0,
    berkeleyUsers: 0,
    invitedUsers: 0,
    totalRides: 0,
    totalEvents: 0,
    avgRideSize: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Berkeley vs invited users
      const { count: berkeleyUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .or('is_invited_user.is.null,is_invited_user.eq.false');

      const { count: invitedUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_invited_user', true);

      // Total ride groups
      const { count: totalRides } = await supabase
        .from('ride_groups')
        .select('*', { count: 'exact', head: true });

      // Total events
      const { count: totalEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });

      // Average ride size
      const { data: memberCounts } = await supabase
        .from('ride_members')
        .select('ride_id')
        .eq('status', 'joined');

      const rideSizes: Record<string, number> = {};
      memberCounts?.forEach((m) => {
        rideSizes[m.ride_id] = (rideSizes[m.ride_id] || 0) + 1;
      });

      const sizes = Object.values(rideSizes);
      const avgRideSize = sizes.length > 0 
        ? sizes.reduce((a, b) => a + b, 0) / sizes.length 
        : 0;

      setAnalytics({
        totalUsers: totalUsers || 0,
        berkeleyUsers: berkeleyUsers || 0,
        invitedUsers: invitedUsers || 0,
        totalRides: totalRides || 0,
        totalEvents: totalEvents || 0,
        avgRideSize: Math.round(avgRideSize * 10) / 10,
      });
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

  const stats = [
    {
      title: "Total Users",
      value: analytics.totalUsers,
      subtitle: `${analytics.berkeleyUsers} Berkeley, ${analytics.invitedUsers} Invited`,
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Ride Groups",
      value: analytics.totalRides,
      subtitle: `Avg ${analytics.avgRideSize} members per ride`,
      icon: Car,
      color: "text-green-600",
    },
    {
      title: "Events",
      value: analytics.totalEvents,
      subtitle: "Total events created",
      icon: Calendar,
      color: "text-purple-600",
    },
    {
      title: "Engagement",
      value: `${Math.round((analytics.totalRides / Math.max(analytics.totalEvents, 1)) * 10) / 10}`,
      subtitle: "Rides per event",
      icon: TrendingUp,
      color: "text-orange-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <Icon className={`w-5 h-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
