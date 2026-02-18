import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Car, Calendar, Activity, CheckCircle, Star, DollarSign, Mail } from "lucide-react";

interface Analytics {
  totalUsers: number;
  berkeleyUsers: number;
  invitedUsers: number;
  activeUsers7d: number;
  totalRides: number;
  avgRideSize: number;
  totalEvents: number;
  upcomingEvents: number;
  completionRate: number;
  avgRating: number;
  totalRatings: number;
  paymentTotal: number;
  paymentConfirmRate: number;
  totalEmailsSent: number;
  emailSuccessRate: number;
  emailsLast24h: number;
}

export const AnalyticsSummary = () => {
  const [analytics, setAnalytics] = useState<Analytics>({
    totalUsers: 0,
    berkeleyUsers: 0,
    invitedUsers: 0,
    activeUsers7d: 0,
    totalRides: 0,
    avgRideSize: 0,
    totalEvents: 0,
    upcomingEvents: 0,
    completionRate: 0,
    avgRating: 0,
    totalRatings: 0,
    paymentTotal: 0,
    paymentConfirmRate: 0,
    totalEmailsSent: 0,
    emailSuccessRate: 0,
    emailsLast24h: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      // Parallel fetches
      const [
        { count: totalUsers },
        { count: berkeleyUsers },
        { count: invitedUsers },
        { data: recentMembers },
        { data: recentMessages },
        { count: totalRides },
        { data: memberCounts },
        { count: totalEvents },
        { count: upcomingEvents },
        { data: completions },
        { data: pastRides },
        { data: ratings },
        { data: payments },
        { data: confirmations },
        { data: emailLogs },
        { count: emailsLast24h },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).or('is_invited_user.is.null,is_invited_user.eq.false'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_invited_user', true),
        supabase.from('ride_members').select('user_id').gte('created_at', sevenDaysAgoISO),
        supabase.from('ride_group_messages').select('user_id').gte('created_at', sevenDaysAgoISO),
        supabase.from('ride_groups').select('*', { count: 'exact', head: true }),
        supabase.from('ride_members').select('ride_id').eq('status', 'joined'),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }).gte('date_time', new Date().toISOString()),
        supabase.from('ride_completions').select('ride_id'),
        supabase.from('ride_groups').select('id, departure_time').lt('departure_time', new Date().toISOString()),
        supabase.from('user_ratings').select('rating'),
        supabase.from('uber_payments').select('id, amount'),
        supabase.from('payment_confirmations').select('uber_payment_id'),
        supabase.from('email_notification_logs').select('success'),
        supabase.from('email_notification_logs').select('*', { count: 'exact', head: true }).gte('sent_at', twentyFourHoursAgo.toISOString()),
      ]);

      // Active users (7d): distinct user IDs from ride_members + messages
      const activeUserIds = new Set<string>();
      recentMembers?.forEach(m => activeUserIds.add(m.user_id));
      recentMessages?.forEach(m => activeUserIds.add(m.user_id));

      // Avg ride size
      const rideSizes: Record<string, number> = {};
      memberCounts?.forEach((m) => {
        rideSizes[m.ride_id] = (rideSizes[m.ride_id] || 0) + 1;
      });
      const sizes = Object.values(rideSizes);
      const avgRideSize = sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;

      // Completion rate
      const completedRideIds = new Set(completions?.map(c => c.ride_id) || []);
      const pastRideCount = pastRides?.length || 0;
      const completionRate = pastRideCount > 0 ? Math.round((completedRideIds.size / pastRideCount) * 100) : 0;

      // Avg rating
      const ratingValues = ratings?.map(r => r.rating).filter((r): r is number => r !== null) || [];
      const avgRating = ratingValues.length > 0 ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length : 0;

      // Payments
      const paymentTotal = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const confirmedPaymentIds = new Set(confirmations?.map(c => c.uber_payment_id) || []);
      const totalPayments = payments?.length || 0;
      const paymentConfirmRate = totalPayments > 0 ? Math.round((confirmedPaymentIds.size / totalPayments) * 100) : 0;

      // Email health
      const totalEmailsSent = emailLogs?.length || 0;
      const successfulEmails = emailLogs?.filter(log => log.success).length || 0;
      const emailSuccessRate = totalEmailsSent > 0 ? Math.round((successfulEmails / totalEmailsSent) * 100) : 0;

      setAnalytics({
        totalUsers: totalUsers || 0,
        berkeleyUsers: berkeleyUsers || 0,
        invitedUsers: invitedUsers || 0,
        activeUsers7d: activeUserIds.size,
        totalRides: totalRides || 0,
        avgRideSize: Math.round(avgRideSize * 10) / 10,
        totalEvents: totalEvents || 0,
        upcomingEvents: upcomingEvents || 0,
        completionRate,
        avgRating: Math.round(avgRating * 10) / 10,
        totalRatings: ratingValues.length,
        paymentTotal: Math.round(paymentTotal * 100) / 100,
        paymentConfirmRate,
        totalEmailsSent,
        emailSuccessRate,
        emailsLast24h: emailsLast24h || 0,
      });
    } catch (error) {
      // Failed to fetch analytics
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
      title: "Active Users (7d)",
      value: analytics.activeUsers7d,
      subtitle: `${analytics.totalUsers > 0 ? Math.round((analytics.activeUsers7d / analytics.totalUsers) * 100) : 0}% of total`,
      icon: Activity,
      color: "text-emerald-600",
    },
    {
      title: "Ride Groups",
      value: analytics.totalRides,
      subtitle: `Avg ${analytics.avgRideSize} members/ride`,
      icon: Car,
      color: "text-green-600",
    },
    {
      title: "Events",
      value: analytics.totalEvents,
      subtitle: `${analytics.upcomingEvents} upcoming`,
      icon: Calendar,
      color: "text-purple-600",
    },
    {
      title: "Completion Rate",
      value: `${analytics.completionRate}%`,
      subtitle: "Of past rides completed",
      icon: CheckCircle,
      color: "text-teal-600",
    },
    {
      title: "Avg Rating",
      value: analytics.avgRating,
      subtitle: `${analytics.totalRatings} total ratings`,
      icon: Star,
      color: "text-yellow-600",
    },
    {
      title: "Payments",
      value: `$${analytics.paymentTotal.toFixed(0)}`,
      subtitle: `${analytics.paymentConfirmRate}% confirmed`,
      icon: DollarSign,
      color: "text-orange-600",
    },
    {
      title: "Email Health",
      value: `${analytics.emailSuccessRate}%`,
      subtitle: `${analytics.emailsLast24h} sent in 24h`,
      icon: Mail,
      color: "text-indigo-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
