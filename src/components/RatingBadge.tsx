import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";

interface RatingBadgeProps {
  userId: string;
  size?: "small" | "large";
  showLabel?: boolean;
}

export const RatingBadge = ({ userId, size = "small", showLabel = false }: RatingBadgeProps) => {
  const [rating, setRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRating();
  }, [userId]);

  const fetchRating = async () => {
    try {
      // Fetch ride stats
      const { data: stats } = await supabase.rpc('get_user_ride_stats', {
        user_uuid: userId
      });

      if (!stats || stats.length === 0 || stats[0].completed_rides === 0) {
        setRating(null);
        setLoading(false);
        return;
      }

      const completionPercentage = stats[0].completion_percentage || 0;

      // Fetch average rating
      const { data: ratings } = await supabase
        .from('user_ratings')
        .select('rating')
        .eq('rated_user_id', userId);

      if (!ratings || ratings.length === 0) {
        setRating(null);
        setLoading(false);
        return;
      }

      const avgRating = ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length;
      
      // Calculate weighted rating
      const weightedRating = (avgRating * completionPercentage) / 100;
      setRating(weightedRating);
    } catch (error) {
      console.error('Error fetching rating:', error);
      setRating(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return size === "small" ? (
      <span className="text-xs text-muted-foreground">...</span>
    ) : null;
  }

  if (rating === null) {
    return (
      <span className={`${size === "small" ? "text-xs" : "text-sm"} text-muted-foreground`}>
        N/A
      </span>
    );
  }

  const iconSize = size === "small" ? "h-3 w-3" : "h-4 w-4";
  const textSize = size === "small" ? "text-xs" : "text-sm";

  return (
    <div className="flex items-center gap-1">
      <Star className={`${iconSize} fill-yellow-400 text-yellow-400`} />
      <span className={`${textSize} font-medium`}>
        {rating.toFixed(1)}
      </span>
      {showLabel && <span className={`${textSize} text-muted-foreground`}>rating</span>}
    </div>
  );
};
