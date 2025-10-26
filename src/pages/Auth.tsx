import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check, MapPin, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import campanileImage from "@/assets/campanile-bay.jpg";


const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [program, setProgram] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteRideId, setInviteRideId] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  // Smart routing helper
  const determinePostLoginRoute = async (userId: string): Promise<string> => {
    try {
      // 1. Check if onboarding is complete (has photo)
      const { data: profile } = await supabase
        .from('profiles')
        .select('photo, email')
        .eq('id', userId)
        .single();
      
      if (!profile?.photo) {
        return '/onboarding';
      }
      
      const isBerkeleyUser = profile.email?.endsWith('@berkeley.edu');
      
      if (isBerkeleyUser) {
        // Berkeley users: check for upcoming rides, else go to events
        const { data: upcomingRides } = await supabase
          .from('ride_members')
          .select(`
            ride_id,
            ride_groups!inner(
              id,
              departure_time
            )
          `)
          .eq('user_id', userId)
          .gte('ride_groups.departure_time', new Date().toISOString())
          .limit(1);
        
        return upcomingRides?.length ? '/my-rides' : '/events';
      } else {
        // External users: always go to My Rides
        return '/my-rides';
      }
    } catch (error) {
      console.error('Error determining route:', error);
      return '/my-rides'; // Safe fallback
    }
  };

  useEffect(() => {
    // Check for invite token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    
    if (token) {
      setInviteToken(token);
      // Validate invite token and get ride info
      validateInviteToken(token);
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const route = await determinePostLoginRoute(session.user.id);
        navigate(route);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const route = await determinePostLoginRoute(session.user.id);
        navigate(route);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateInviteToken = async (token: string) => {
    try {
      const { data: inviteData, error } = await supabase
        .from('ride_invites')
        .select(`
          ride_id, 
          expires_at, 
          max_uses, 
          use_count,
          invited_email,
          inviter_name,
          ride_groups (
            id,
            travel_mode,
            events (
              name,
              destination,
              city
            )
          )
        `)
        .eq('invite_token', token)
        .single();

      if (error || !inviteData) {
        toast.error("Invalid invite link");
        return;
      }

      if (new Date(inviteData.expires_at) < new Date()) {
        toast.error("This invite link has expired");
        return;
      }

      if (inviteData.max_uses && inviteData.use_count >= inviteData.max_uses) {
        toast.error("This invite link has reached its maximum uses");
        return;
      }

      setInviteRideId(inviteData.ride_id);
      setInviteDetails(inviteData);
      if (inviteData.invited_email) {
        setEmail(inviteData.invited_email);
      }
      toast.success("You've been invited to join a ride! Please create your account to continue.");
    } catch (error: any) {
      toast.error("Failed to validate invite link");
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      toast.error("Please enter your name");
      return;
    }
    
    const isBerkeleyEmail = email.toLowerCase().endsWith('@berkeley.edu');
    
    if (isBerkeleyEmail && !program) {
      toast.error("Please enter your program");
      return;
    }

    try {
      setLoading(true);
      const isBerkeleyEmail = email.toLowerCase().endsWith('@berkeley.edu');
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: {
            name,
            program: program || 'Not specified',
            is_invited_user: !isBerkeleyEmail,
            invited_via_ride_id: inviteRideId
          }
        }
      });

      if (error) throw error;

      if (inviteToken && data.user) {
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
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const route = await determinePostLoginRoute(user.id);
        toast.success("Signed in successfully!");
        navigate(route);
      }
    } catch (error: any) {
      // Error already handled above
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      toast.error("Please enter your email address");
      return;
    }

    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset link sent to your email");
      setForgotPasswordOpen(false);
      setResetEmail("");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      
      // Build redirect URL with invite token if present
      let redirectUrl = `${window.location.origin}/onboarding`;
      if (inviteToken) {
        redirectUrl += `?invite=${inviteToken}`;
      }
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
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
      
      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold text-white drop-shadow-lg">Berkeley Rides</h1>
          <p className="text-xl text-white/90 drop-shadow-md">Share rides to off-campus events and destinations</p>
        </div>

        {inviteDetails && (
          <Card className="bg-primary/5 border-primary">
            <CardContent className="pt-6">
              <p className="text-sm font-medium mb-2">🎉 You're invited!</p>
              <p className="text-sm text-muted-foreground">
                <strong>{inviteDetails.inviter_name}</strong> invited you to join their ride to{' '}
                <strong>{inviteDetails.ride_groups?.events?.name}</strong>
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Welcome to Berkeley Rides</CardTitle>
            <CardDescription>
              {inviteToken 
                ? "You've been invited to join a ride! Sign in with Google to continue."
                : "Berkeley students: Sign in with your Google account. New users will need to complete onboarding."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              variant="default"
              className="w-full h-12 text-base"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or sign in with email</span>
              </div>
            </div>

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
                     <button
                       type="button"
                       onClick={() => setForgotPasswordOpen(true)}
                       className="text-sm text-primary hover:underline text-left mt-1"
                     >
                       Forgot password?
                     </button>
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
                   {!inviteToken && (
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
                   )}
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

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Trusted Community</p>
                  <p className="text-xs text-muted-foreground">Only Berkeley.edu emails or Berkeley-invited people can access the app</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Coordinate Rides</p>
                  <p className="text-xs text-muted-foreground">Share rides to off-campus events and popular destinations</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Wallet className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Affordable Travel</p>
                  <p className="text-xs text-muted-foreground">Split costs and save money on transportation</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="your.email@berkeley.edu"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setForgotPasswordOpen(false);
                setResetEmail("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleForgotPassword} disabled={sendingReset}>
              {sendingReset ? "Sending..." : "Send Reset Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;