import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search, DollarSign, Clock, CheckCircle, Receipt } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface PaymentRow {
  id: string;
  event_name: string;
  payer_name: string;
  payer_email: string;
  amount: number | null;
  cost_type: string | null;
  confirmed: boolean;
  confirmation_count: number;
  created_at: string;
}

export const PaymentsTab = () => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchPayments();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      setFilteredPayments(payments.filter(p =>
        p.payer_name.toLowerCase().includes(q) ||
        p.payer_email.toLowerCase().includes(q) ||
        p.event_name.toLowerCase().includes(q)
      ));
    } else {
      setFilteredPayments(payments);
    }
  }, [searchQuery, payments]);

  const fetchPayments = async () => {
    try {
      const [{ data: paymentData }, { data: confirmations }] = await Promise.all([
        supabase.from('uber_payments').select(`
          id, amount, cost_type, created_at,
          profiles!inner(name, email),
          ride_groups!inner(events!inner(name))
        `).order('created_at', { ascending: false }),
        supabase.from('payment_confirmations').select('uber_payment_id'),
      ]);

      const confirmCounts: Record<string, number> = {};
      confirmations?.forEach(c => {
        confirmCounts[c.uber_payment_id] = (confirmCounts[c.uber_payment_id] || 0) + 1;
      });

      const rows: PaymentRow[] = (paymentData || []).map((p: any) => ({
        id: p.id,
        event_name: p.ride_groups?.events?.name || 'Unknown',
        payer_name: p.profiles?.name || 'Unknown',
        payer_email: p.profiles?.email || '',
        amount: p.amount,
        cost_type: p.cost_type,
        confirmed: (confirmCounts[p.id] || 0) > 0,
        confirmation_count: confirmCounts[p.id] || 0,
        created_at: p.created_at,
      }));

      setPayments(rows);
      setFilteredPayments(rows);
    } catch (error) {
      toast.error("Failed to load payment data");
    } finally {
      setLoading(false);
    }
  };

  const totalVolume = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const avgPayment = payments.length > 0 ? totalVolume / payments.length : 0;
  const confirmedCount = payments.filter(p => p.confirmed).length;
  const confirmRate = payments.length > 0 ? Math.round((confirmedCount / payments.length) * 100) : 0;
  const pendingCount = payments.filter(p => !p.confirmed).length;

  const exportToCSV = () => {
    const headers = ['Event', 'Payer', 'Email', 'Amount', 'Type', 'Confirmed', 'Confirmations', 'Date'];
    const rows = filteredPayments.map(p => [
      p.event_name, p.payer_name, p.payer_email,
      p.amount ? `$${p.amount.toFixed(2)}` : 'N/A',
      p.cost_type || 'N/A',
      p.confirmed ? 'Yes' : 'No',
      p.confirmation_count,
      p.created_at ? format(new Date(p.created_at), 'MMM d, yyyy h:mm a') : '',
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Payments exported successfully");
  };

  if (loading) return <div className="text-center py-8">Loading payments...</div>;

  const statCards = [
    { title: "Total Volume", value: `$${totalVolume.toFixed(2)}`, icon: DollarSign, color: "text-green-600" },
    { title: "Avg Payment", value: `$${avgPayment.toFixed(2)}`, icon: Receipt, color: "text-blue-600" },
    { title: "Confirmation Rate", value: `${confirmRate}%`, icon: CheckCircle, color: "text-emerald-600" },
    { title: "Pending", value: pendingCount, icon: Clock, color: "text-orange-600" },
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payments ({filteredPayments.length})</CardTitle>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, email, or event..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.event_name}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{p.payer_name}</p>
                        <p className="text-xs text-muted-foreground">{p.payer_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{p.amount ? `$${p.amount.toFixed(2)}` : 'N/A'}</TableCell>
                    <TableCell>{p.cost_type || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={p.confirmed ? "default" : "secondary"}>
                        {p.confirmed ? `Confirmed (${p.confirmation_count})` : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.created_at ? format(new Date(p.created_at), 'MMM d, yyyy') : ''}</TableCell>
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
