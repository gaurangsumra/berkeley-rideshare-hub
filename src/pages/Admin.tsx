import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsSummary } from "@/components/admin/AnalyticsSummary";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { UserDataTable } from "@/components/admin/UserDataTable";
import { EventsTab } from "@/components/admin/EventsTab";
import { RideMembershipTable } from "@/components/admin/RideMembershipTable";
import { PaymentsTab } from "@/components/admin/PaymentsTab";
import { FeedbackTab } from "@/components/admin/FeedbackTab";
import { RatingsTab } from "@/components/admin/RatingsTab";
import { SystemTab } from "@/components/admin/SystemTab";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useUserRole();
  const [activeTab, setActiveTab] = useState("overview");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/events");
    }
  }, [loading, isAdmin, navigate]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navigation />

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Card className="mb-6 bg-gradient-to-br from-primary/10 to-accent/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Shield className="w-6 h-6" />
              Admin Dashboard
            </CardTitle>
            <CardDescription>
              Comprehensive platform management and analytics
            </CardDescription>
          </CardHeader>
        </Card>

        <AnalyticsSummary />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex w-auto min-w-full md:min-w-0">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="rides">Rides</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="ratings">Ratings</TabsTrigger>
              <TabsTrigger value="system">System</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UserDataTable />
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            <EventsTab />
          </TabsContent>

          <TabsContent value="rides" className="mt-6">
            <RideMembershipTable />
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <PaymentsTab />
          </TabsContent>

          <TabsContent value="feedback" className="mt-6">
            <FeedbackTab />
          </TabsContent>

          <TabsContent value="ratings" className="mt-6">
            <RatingsTab />
          </TabsContent>

          <TabsContent value="system" className="mt-6">
            <SystemTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
