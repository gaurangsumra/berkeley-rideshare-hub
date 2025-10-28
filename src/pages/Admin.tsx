import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserDataTable } from "@/components/admin/UserDataTable";
import { RideMembershipTable } from "@/components/admin/RideMembershipTable";
import { AnalyticsSummary } from "@/components/admin/AnalyticsSummary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useUserRole();
  const [activeTab, setActiveTab] = useState("users");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    navigate("/events");
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
              Comprehensive user data and ride group management
            </CardDescription>
          </CardHeader>
        </Card>

        <AnalyticsSummary />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">User Data</TabsTrigger>
            <TabsTrigger value="rides">Ride Memberships</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <UserDataTable />
          </TabsContent>

          <TabsContent value="rides" className="mt-6">
            <RideMembershipTable />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
