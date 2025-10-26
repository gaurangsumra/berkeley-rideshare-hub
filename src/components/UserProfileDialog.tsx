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
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [rideCount, setRideCount] = useState(0);

  useEffect(() => {
    if (open && userId) {
      fetchProfile();
    }
  }, [open, userId]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('name, photo, program')
      .eq('id', userId)
      .single();

    setProfile(data);

    // Fetch ratings
    const { data: ratings } = await supabase
      .from('user_ratings')
      .select('rating')
      .eq('rated_user_id', userId);

    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      setAvgRating(avg);
    }

    // Count rides
    const { count } = await supabase
      .from('ride_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    setRideCount(count || 0);
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

          {avgRating !== null && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= Math.round(avgRating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {avgRating.toFixed(1)} average rating
              </span>
            </div>
          )}

          <Badge variant="secondary">{rideCount} rides completed</Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
};
