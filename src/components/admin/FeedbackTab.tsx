import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Download, Search, Inbox, Clock, Loader2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { FeedbackDetailDialog } from "./FeedbackDetailDialog";

interface FeedbackItem {
  id: string;
  subject: string;
  description: string;
  feedback_type: string;
  status: string;
  contact_email: string;
  admin_notes: string | null;
  created_at: string;
}

const typeColors: Record<string, string> = {
  bug: "bg-red-100 text-red-800",
  feature: "bg-blue-100 text-blue-800",
  question: "bg-yellow-100 text-yellow-800",
  complaint: "bg-orange-100 text-orange-800",
  compliment: "bg-green-100 text-green-800",
};

const statusColors: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const chartConfig: ChartConfig = {
  count: { label: "Count", color: "hsl(221, 83%, 53%)" },
};

export const FeedbackTab = () => {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchFeedback();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      setFilteredFeedback(feedback.filter(f =>
        f.subject.toLowerCase().includes(q) ||
        f.contact_email.toLowerCase().includes(q) ||
        f.feedback_type.toLowerCase().includes(q)
      ));
    } else {
      setFilteredFeedback(feedback);
    }
  }, [searchQuery, feedback]);

  const fetchFeedback = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_submissions')
        .select('id, subject, description, feedback_type, status, contact_email, admin_notes, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedback(data || []);
      setFilteredFeedback(data || []);
    } catch (error) {
      toast.error("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  };

  const total = feedback.length;
  const openCount = feedback.filter(f => f.status === 'open').length;
  const inProgressCount = feedback.filter(f => f.status === 'in_progress').length;
  const resolvedCount = feedback.filter(f => f.status === 'resolved' || f.status === 'closed').length;

  // Type distribution chart
  const typeCounts: Record<string, number> = {};
  feedback.forEach(f => {
    typeCounts[f.feedback_type] = (typeCounts[f.feedback_type] || 0) + 1;
  });
  const typeData = Object.entries(typeCounts).map(([type, count]) => ({ type, count }));

  const exportToCSV = () => {
    const headers = ['Subject', 'Type', 'Status', 'Contact', 'Date', 'Admin Notes'];
    const rows = filteredFeedback.map(f => [
      f.subject, f.feedback_type, f.status, f.contact_email,
      format(new Date(f.created_at), 'MMM d, yyyy h:mm a'),
      f.admin_notes || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Feedback exported successfully");
  };

  if (loading) return <div className="text-center py-8">Loading feedback...</div>;

  const statCards = [
    { title: "Total", value: total, icon: Inbox, color: "text-blue-600" },
    { title: "Open", value: openCount, icon: Clock, color: "text-yellow-600" },
    { title: "In Progress", value: inProgressCount, icon: Loader2, color: "text-blue-600" },
    { title: "Resolved", value: resolvedCount, icon: CheckCircle, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.title}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${s.color}`} />
                  <p className="text-sm text-muted-foreground">{s.title}</p>
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {typeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feedback by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Feedback ({filteredFeedback.length})</CardTitle>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search feedback..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.map((f) => (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setSelectedFeedback(f); setDialogOpen(true); }}
                  >
                    <TableCell className="font-medium">{f.subject}</TableCell>
                    <TableCell>
                      <Badge className={typeColors[f.feedback_type] || ""} variant="outline">
                        {f.feedback_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[f.status] || ""}>{f.status}</Badge>
                    </TableCell>
                    <TableCell>{f.contact_email}</TableCell>
                    <TableCell>{format(new Date(f.created_at), 'MMM d, yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FeedbackDetailDialog
        feedback={selectedFeedback}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdated={fetchFeedback}
      />
    </div>
  );
};
