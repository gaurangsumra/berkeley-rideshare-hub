import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export const UserProfileDialog = ({ open, onOpenChange, userId }: UserProfileDialogProps) => {
  const [profile, setProfile] = useState<any>(null);
  const [weightedRating, setWeightedRating] = useState<number | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (open && userId) {
      fetchProfile();
    }
  }, [open, userId]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('name, photo, program, venmo_username')
      .eq('id', userId)
      .single();

    setProfile(data);

    // Fetch ride stats
    const { data: rideStats } = await supabase.rpc('get_user_ride_stats', {
      user_uuid: userId
    });

    if (rideStats && rideStats.length > 0) {
      setStats(rideStats[0]);

      // Calculate weighted rating if user has completed rides
      if (rideStats[0].completed_rides > 0) {
        const { data: ratings } = await supabase
          .from('user_ratings')
          .select('rating')
          .eq('rated_user_id', userId);

        if (ratings && ratings.length > 0) {
          const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
          const weighted = (avg * rideStats[0].completion_percentage) / 100;
          setWeightedRating(weighted);
        }
      }
    }
  };

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rider Profile</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          <Avatar className="h-24 w-24">
            <AvatarImage src={profile.photo || undefined} />
            <AvatarFallback className="text-2xl">
              {profile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="text-center">
            <h3 className="text-xl font-semibold">{profile.name}</h3>
            <p className="text-sm text-muted-foreground">{profile.program}</p>
          </div>

          <div className="w-full space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completed Rides</span>
              <span className="font-medium">{stats?.completed_rides || 0}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completion Rate</span>
              <span className="font-medium">{stats?.completion_percentage || 0}%</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">User Rating</span>
              {weightedRating !== null ? (
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= Math.round(weightedRating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-medium">{weightedRating.toFixed(1)}</span>
                </div>
              ) : (
                <span className="font-medium">N/A</span>
              )}
            </div>
          </div>

          {profile?.venmo_username && (
            <a
              href={`https://venmo.com/${profile.venmo_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-center text-sm font-medium"
            >
              Send Payment via Venmo
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
