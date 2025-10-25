import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Users, MapPin } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [program, setProgram] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteRideId, setInviteRideId] = useState<string | null>(null);

  useEffect(() => {
    // Check for invite token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    
    if (token) {
      setInviteToken(token);
      // Validate invite token and get ride info
      validateInviteToken(token);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/onboarding");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate("/onboarding");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateInviteToken = async (token: string) => {
    try {
      const { data, error } = await supabase
        .from('ride_invites')
        .select('ride_id, expires_at, max_uses, use_count')
        .eq('invite_token', token)
        .single();

      if (error || !data) {
        toast.error("Invalid invite link");
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        toast.error("This invite link has expired");
        return;
      }

      // Check if max uses reached
      if (data.max_uses && data.use_count >= data.max_uses) {
        toast.error("This invite link has reached its maximum uses");
        return;
      }

      setInviteRideId(data.ride_id);
      toast.success("You've been invited to join a ride! Please sign up or sign in to continue.");
    } catch (error: any) {
      toast.error("Failed to validate invite link");
    }
  };

  const validateBerkeleyEmail = (email: string): boolean => {
    // Skip Berkeley email validation if user has an invite token
    if (inviteToken) return true;
    return email.toLowerCase().endsWith('@berkeley.edu');
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateBerkeleyEmail(email)) {
      toast.error("Please use your @berkeley.edu email address");
      return;
    }

    if (!name || !program) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: {
            name,
            program,
            is_invited_user: !!inviteToken,
            invited_via_ride_id: inviteRideId
          }
        }
      });

      if (error) throw error;

      // If invited user, update their profile and increment invite use count
      if (inviteToken && data.user) {
        await supabase
          .from('profiles')
          .update({ 
            is_invited_user: true, 
            invited_via_ride_id: inviteRideId 
          })
          .eq('id', data.user.id);

        // Increment use count
        const { data: inviteData } = await supabase
          .from('ride_invites')
          .select('use_count')
          .eq('invite_token', inviteToken)
          .single();
        
        if (inviteData) {
          await supabase
            .from('ride_invites')
            .update({ use_count: inviteData.use_count + 1 })
            .eq('invite_token', inviteToken);
        }
      }
      
      toast.success("Verification email sent! Please check your inbox and verify your email before signing in.", {
        duration: 6000
      });
      setEmail("");
      setPassword("");
      setName("");
      setProgram("");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateBerkeleyEmail(email)) {
      toast.error("Please use your @berkeley.edu email address");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          toast.error("Please verify your email before signing in. Check your inbox for the verification link.");
        } else {
          toast.error(error.message || "Failed to sign in");
        }
        throw error;
      }
      
      toast.success("Signed in successfully!");
      navigate("/onboarding");
    } catch (error: any) {
      // Error already handled above
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            hd: 'berkeley.edu'
          }
        }
      });
      
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with Google");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-primary">Berkeley Rides</h1>
          <p className="text-muted-foreground">Trusted ride coordination for UC Berkeley students</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome to Berkeley Rides</CardTitle>
            <CardDescription>
              {inviteToken 
                ? "You've been invited to join a ride! Create your account to continue."
                : "Use your @berkeley.edu email to access the platform. New users will receive a verification email."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div>
                    <Label htmlFor="signin-email">Berkeley Email *</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@berkeley.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signin-password">Password *</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleEmailSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="signup-name">Full Name *</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                   <div>
                     <Label htmlFor="signup-email">
                       {inviteToken ? "Email *" : "Berkeley Email *"}
                     </Label>
                     <Input
                       id="signup-email"
                       type="email"
                       placeholder={inviteToken ? "your@email.com" : "you@berkeley.edu"}
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       required
                     />
                   </div>
                  <div>
                    <Label htmlFor="signup-program">Program *</Label>
                    <Input
                      id="signup-program"
                      type="text"
                      placeholder="e.g., Haas MBA, MEng, Undergraduate"
                      value={program}
                      onChange={(e) => setProgram(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">Password *</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              Sign in with Google
            </Button>

            <div className="space-y-3 pt-4 border-t">
              {!inviteToken && (
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Verified Berkeley Only</p>
                    <p className="text-xs text-muted-foreground">Only @berkeley.edu emails can access</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Trusted Community</p>
                  <p className="text-xs text-muted-foreground">Connect with verified Cal students</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Coordinate Rides</p>
                  <p className="text-xs text-muted-foreground">Share rides to off-campus events</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;