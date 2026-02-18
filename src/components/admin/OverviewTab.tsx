import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subWeeks, startOfWeek, isAfter } from "date-fns";
import { MapPin, CalendarDays, UserPlus, MessageSquare } from "lucide-react";

interface WeeklySignup {
  week: string;
  berkeley: number;
  invited: number;
}

interface WeeklyRide {
  week: string;
  uber: number;
  lyft: number;
  drive: number;
  other: number;
}

interface QuickStat {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
}

const signupChartConfig: ChartConfig = {
  berkeley: { label: "Berkeley", color: "hsl(221, 83%, 53%)" },
  invited: { label: "Invited", color: "hsl(262, 83%, 58%)" },
};

const rideChartConfig: ChartConfig = {
  uber: { label: "Uber", color: "hsl(0, 0%, 15%)" },
  lyft: { label: "Lyft", color: "hsl(300, 80%, 50%)" },
  drive: { label: "Drive", color: "hsl(142, 71%, 45%)" },
  other: { label: "Other", color: "hsl(38, 92%, 50%)" },
};

export const OverviewTab = () => {
  const [signupData, setSignupData] = useState<WeeklySignup[]>([]);
  const [rideData, setRideData] = useState<WeeklyRide[]>([]);
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      const twelveWeeksAgo = subWeeks(new Date(), 12);

      const [
        { data: profiles },
        { data: rideGroups },
        { data: events },
        { data: invites },
        { data: messages7d },
        { data: recentNotifications },
      ] = await Promise.all([
        supabase.from('profiles').select('created_at, is_invited_user').gte('created_at', twelveWeeksAgo.toISOString()),
        supabase.from('ride_groups').select('created_at, travel_mode').gte('created_at', twelveWeeksAgo.toISOString()),
        supabase.from('events').select('destination'),
        supabase.from('ride_invites').select('id, use_count'),
        supabase.from('ride_group_messages').select('id').gte('created_at', subWeeks(new Date(), 1).toISOString()),
        supabase.from('notifications').select('id, title, message, type, created_at').order('created_at', { ascending: false }).limit(10),
      ]);

      // Weekly signups
      const weeklySignups: Record<string, { berkeley: number; invited: number }> = {};
      for (let i = 11; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(new Date(), i));
        const key = format(weekStart, 'MMM d');
        weeklySignups[key] = { berkeley: 0, invited: 0 };
      }

      profiles?.forEach(p => {
        if (!p.created_at) return;
        const weekStart = startOfWeek(new Date(p.created_at));
        if (!isAfter(weekStart, subWeeks(startOfWeek(new Date()), 12))) return;
        const key = format(weekStart, 'MMM d');
        if (weeklySignups[key]) {
          if (p.is_invited_user) {
            weeklySignups[key].invited++;
          } else {
            weeklySignups[key].berkeley++;
          }
        }
      });

      setSignupData(Object.entries(weeklySignups).map(([week, data]) => ({ week, ...data })));

      // Weekly rides by travel mode
      const weeklyRides: Record<string, { uber: number; lyft: number; drive: number; other: number }> = {};
      for (let i = 11; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(new Date(), i));
        const key = format(weekStart, 'MMM d');
        weeklyRides[key] = { uber: 0, lyft: 0, drive: 0, other: 0 };
      }

      rideGroups?.forEach(r => {
        if (!r.created_at) return;
        const weekStart = startOfWeek(new Date(r.created_at));
        if (!isAfter(weekStart, subWeeks(startOfWeek(new Date()), 12))) return;
        const key = format(weekStart, 'MMM d');
        if (weeklyRides[key]) {
          const mode = r.travel_mode.toLowerCase();
          if (mode.includes('uber')) weeklyRides[key].uber++;
          else if (mode.includes('lyft')) weeklyRides[key].lyft++;
          else if (mode.includes('driv')) weeklyRides[key].drive++;
          else weeklyRides[key].other++;
        }
      });

      setRideData(Object.entries(weeklyRides).map(([week, data]) => ({ week, ...data })));

      // Quick stats
      const destCounts: Record<string, number> = {};
      events?.forEach(e => {
        destCounts[e.destination] = (destCounts[e.destination] || 0) + 1;
      });
      const topDest = Object.entries(destCounts).sort((a, b) => b[1] - a[1])[0];

      const totalInvites = invites?.length || 0;
      const usedInvites = invites?.filter(i => i.use_count > 0).length || 0;
      const conversionRate = totalInvites > 0 ? Math.round((usedInvites / totalInvites) * 100) : 0;

      setQuickStats([
        { label: "Top Destination", value: topDest ? topDest[0] : "N/A", icon: MapPin },
        { label: "Total Events", value: `${events?.length || 0} created`, icon: CalendarDays },
        { label: "Invite Conversion", value: `${conversionRate}%`, icon: UserPlus },
        { label: "Chat Activity (7d)", value: `${messages7d?.length || 0} messages`, icon: MessageSquare },
      ]);

      setNotifications(recentNotifications || []);
    } catch (error) {
      // Failed to fetch overview data
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading overview...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Signups (12 weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={signupChartConfig} className="h-[250px] w-full">
              <AreaChart data={signupData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="berkeley" stackId="1" fill="var(--color-berkeley)" stroke="var(--color-berkeley)" fillOpacity={0.6} />
                <Area type="monotone" dataKey="invited" stackId="1" fill="var(--color-invited)" stroke="var(--color-invited)" fillOpacity={0.6} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rides Created (12 weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={rideChartConfig} className="h-[250px] w-full">
              <BarChart data={rideData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="uber" stackId="1" fill="var(--color-uber)" />
                <Bar dataKey="lyft" stackId="1" fill="var(--color-lyft)" />
                <Bar dataKey="drive" stackId="1" fill="var(--color-drive)" />
                <Bar dataKey="other" stackId="1" fill="var(--color-other)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
                <p className="text-lg font-semibold truncate">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent activity feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 border-b last:border-0 pb-3 last:pb-0">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {n.created_at ? format(new Date(n.created_at), 'MMM d, h:mm a') : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
