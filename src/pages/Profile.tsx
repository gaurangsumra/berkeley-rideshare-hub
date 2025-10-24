import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navigation } from "@/components/Navigation";
import { toast } from "sonner";
import { LogOut, User } from "lucide-react";

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [program, setProgram] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
      }
    });
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
      setProgram(data.program || "");
    } catch (error: any) {
      toast.error("Failed to load profile");
    }
  };

  const handleUpdateProgram = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({ program })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success("Program updated successfully");
    } catch (error: any) {
      toast.error("Failed to update program");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary">Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Your Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={profile.name} disabled className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={profile.email} disabled className="mt-1" />
            </div>
            <div>
              <Label htmlFor="program">Program</Label>
              <Input
                id="program"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                placeholder="e.g., Haas MBA, MEng, Undergraduate"
                className="mt-1"
              />
              <Button
                onClick={handleUpdateProgram}
                disabled={loading || program === profile.program}
                className="mt-2"
              >
                Update Program
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleSignOut}
          variant="destructive"
          className="w-full"
          size="lg"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <Navigation />
    </div>
  );
};

export default Profile;