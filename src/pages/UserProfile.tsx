import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { RatingBadge } from "@/components/RatingBadge";
import { Navigation } from "@/components/Navigation";

interface Profile {
  id: string;
  name: string;
  photo: string | null;
  program: string;
  venmo_username: string | null;
}

interface UserStats {
  completedRides: number;
  totalRides: number;
  completionRate: number;
  averageRating: number;
}

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndFetch();
  }, [userId, navigate]);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('photo')
      .eq('id', session.user.id)
      .single();

    if (!currentProfile?.photo) {
      navigate("/onboarding");
      return;
    }

    fetchProfileData();
  };

  const fetchProfileData = async () => {
    if (!userId) return;

    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      if (!profileData) {
        toast.error("User not found");
        navigate(-1);
        return;
      }

      // Fetch venmo_username separately
      const { data: fullProfile } = await supabase
        .from('profiles')
        .select('venmo_username')
        .eq('id', userId)
        .single();

      setProfile({
        ...profileData,
        venmo_username: fullProfile?.venmo_username || null
      });

      // Fetch stats
      const [completionsRes, ridesRes, ratingsRes] = await Promise.all([
        supabase
          .from('ride_completions')
          .select('id')
          .eq('user_id', userId)
          .eq('confirmed_by_consensus', true),
        supabase
          .from('ride_members')
          .select('id')
          .eq('user_id', userId),
        supabase
          .from('user_ratings')
          .select('rating')
          .eq('rated_user_id', userId)
      ]);

      const completedCount = completionsRes.data?.length || 0;
      const totalCount = ridesRes.data?.length || 0;
      const ratings = ratingsRes.data || [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length
        : 0;

      setStats({
        completedRides: completedCount,
        totalRides: totalCount,
        completionRate: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
        averageRating: avgRating
      });
    } catch (error: any) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load user profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <div className="text-center">
          <p className="text-muted-foreground">User not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navigation />
      
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Avatar className="w-32 h-32 border-4 border-primary">
                <AvatarImage src={profile.photo || undefined} />
                <AvatarFallback className="text-4xl">
                  {profile.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2">{profile.name}</h1>
                <p className="text-lg text-muted-foreground">{profile.program}</p>
              </div>

              <div className="pt-2">
                <RatingBadge userId={profile.id} size="large" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-4xl font-bold text-primary mb-2">
                  {stats.completedRides}
                </p>
                <p className="text-sm text-muted-foreground">Completed Rides</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-4xl font-bold text-primary mb-2">
                  {stats.completionRate.toFixed(0)}%
                </p>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-4xl font-bold text-primary mb-2">
                  {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">Average Rating</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Venmo Link */}
        {profile.venmo_username && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-muted-foreground mb-3">
                Payment Information
              </p>
              <a
                href={`https://venmo.com/${profile.venmo_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#3D95CE] flex items-center justify-center text-white font-bold">
                    V
                  </div>
                  <div>
                    <p className="font-semibold">Send Payment via Venmo</p>
                    <p className="text-sm text-muted-foreground">@{profile.venmo_username}</p>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 text-muted-foreground" />
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
