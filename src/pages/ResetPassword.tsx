import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import campanileImage from "@/assets/campanile-bay.jpg";


const ResetPassword = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated successfully!");
    
    // Smart routing after password reset
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('photo')
          .eq('id', user.id)
          .single();
        
        if (!profile?.photo) {
          navigate('/onboarding');
        } else {
          const { data: upcomingRides } = await supabase
            .from('ride_members')
            .select(`
              ride_id,
              ride_groups!inner(
                id,
                departure_time
              )
            `)
            .eq('user_id', user.id)
            .gte('ride_groups.departure_time', new Date().toISOString())
            .limit(1);
          
          if (upcomingRides && upcomingRides.length > 0) {
            navigate('/my-rides');
          } else {
            navigate('/events');
          }
        }
      } catch (error) {
        navigate('/events');
      }
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${campanileImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/60" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-5xl font-bold text-white drop-shadow-lg">Berkeley Rides</h1>
          <p className="text-xl text-white/90 drop-shadow-md">Reset your password</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Set New Password
            </CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default ResetPassword;
