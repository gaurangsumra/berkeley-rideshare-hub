import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { RideNotificationStats } from "./RideNotificationStats";

interface DailyEmail {
  date: string;
  success: number;
  failure: number;
}

interface TypeBreakdown {
  type: string;
  count: number;
}

interface InviteRow {
  id: string;
  invite_token: string;
  invited_email: string | null;
  inviter_name: string | null;
  use_count: number;
  max_uses: number | null;
  expires_at: string;
  created_at: string;
}

interface SurveyRow {
  id: string;
  survey_status: string;
  responses_received: number;
  total_members: number;
  survey_deadline: string;
  ride_event_name: string;
}

const emailChartConfig: ChartConfig = {
  success: { label: "Success", color: "hsl(142, 71%, 45%)" },
  failure: { label: "Failure", color: "hsl(0, 84%, 60%)" },
};

const typeChartConfig: ChartConfig = {
  count: { label: "Count", color: "hsl(221, 83%, 53%)" },
};

export const SystemTab = () => {
  const [emailChart, setEmailChart] = useState<DailyEmail[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<TypeBreakdown[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemData();
  }, []);

  const fetchSystemData = async () => {
    try {
      const thirtyDaysAgo = subDays(new Date(), 30);

      const [
        { data: emailLogs },
        { data: inviteData },
        { data: surveyData },
      ] = await Promise.all([
        supabase.from('email_notification_logs').select('success, sent_at, notification_type').gte('sent_at', thirtyDaysAgo.toISOString()),
        supabase.from('ride_invites').select('id, invite_token, invited_email, inviter_name, use_count, max_uses, expires_at, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('ride_attendance_surveys').select('id, survey_status, responses_received, total_members, survey_deadline, ride_id, ride_groups!inner(events!inner(name))').order('created_at', { ascending: false }).limit(50),
      ]);

      // Email delivery chart (30 days)
      const dailyEmails: Record<string, { success: number; failure: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const day = startOfDay(subDays(new Date(), i));
        const key = format(day, 'MMM d');
        dailyEmails[key] = { success: 0, failure: 0 };
      }

      emailLogs?.forEach(log => {
        const day = startOfDay(new Date(log.sent_at));
        const key = format(day, 'MMM d');
        if (dailyEmails[key]) {
          if (log.success) dailyEmails[key].success++;
          else dailyEmails[key].failure++;
        }
      });

      setEmailChart(Object.entries(dailyEmails).map(([date, data]) => ({ date, ...data })));

      // Notification type breakdown
      const typeCounts: Record<string, number> = {};
      emailLogs?.forEach(log => {
        typeCounts[log.notification_type] = (typeCounts[log.notification_type] || 0) + 1;
      });
      setTypeBreakdown(
        Object.entries(typeCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => ({ type, count }))
      );

      // Invites
      setInvites(inviteData || []);

      // Surveys
      const surveyRows: SurveyRow[] = (surveyData || []).map((s: any) => ({
        id: s.id,
        survey_status: s.survey_status,
        responses_received: s.responses_received,
        total_members: s.total_members,
        survey_deadline: s.survey_deadline,
        ride_event_name: s.ride_groups?.events?.name || 'Unknown',
      }));
      setSurveys(surveyRows);
    } catch (error) {
      // Failed to fetch system data
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading system data...</div>;

  const totalInvites = invites.length;
  const usedInvites = invites.filter(i => i.use_count > 0).length;
  const totalSurveys = surveys.length;
  const completedSurveys = surveys.filter(s => s.survey_status === 'completed').length;

  const surveyStatusColor: Record<string, string> = {
    pending: "secondary",
    in_progress: "default",
    completed: "default",
    expired: "secondary",
  };

  return (
    <div className="space-y-6">
      {/* Email delivery chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Delivery (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={emailChartConfig} className="h-[250px] w-full">
              <LineChart data={emailChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={10} tickLine={false} interval={4} />
                <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="success" stroke="var(--color-success)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="failure" stroke="var(--color-failure)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification Types (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={typeChartConfig} className="h-[250px] w-full">
              <BarChart data={typeBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="type" fontSize={10} tickLine={false} width={140} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Existing notification stats table */}
      <RideNotificationStats />

      {/* Invite tokens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Invite Tokens ({totalInvites} total, {usedInvites} used)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Inviter</TableHead>
                  <TableHead className="text-right">Uses</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.slice(0, 20).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invite_token.substring(0, 12)}...</TableCell>
                    <TableCell>{inv.invited_email || '-'}</TableCell>
                    <TableCell>{inv.inviter_name || '-'}</TableCell>
                    <TableCell className="text-right">
                      {inv.use_count}{inv.max_uses ? `/${inv.max_uses}` : ''}
                    </TableCell>
                    <TableCell>{format(new Date(inv.expires_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{format(new Date(inv.created_at), 'MMM d, yyyy')}</TableCell>
                  </TableRow>
                ))}
                {invites.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No invite tokens</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Attendance surveys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Attendance Surveys ({totalSurveys} total, {completedSurveys} completed)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Responses</TableHead>
                  <TableHead>Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surveys.slice(0, 20).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.ride_event_name}</TableCell>
                    <TableCell>
                      <Badge variant={surveyStatusColor[s.survey_status] as "default" | "secondary" || "secondary"}>
                        {s.survey_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{s.responses_received}/{s.total_members}</TableCell>
                    <TableCell>{format(new Date(s.survey_deadline), 'MMM d, yyyy h:mm a')}</TableCell>
                  </TableRow>
                ))}
                {surveys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">No surveys</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
