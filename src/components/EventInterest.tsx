import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EventInterestProps {
    eventId: string;
}

export const EventInterest = ({ eventId }: EventInterestProps) => {
    const [liked, setLiked] = useState(false);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const fetchInterest = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            setUserId(session.user.id);

            // Get total count
            const { count: totalCount } = await supabase
                .from('event_interests')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId);

            setCount(totalCount || 0);

            // Check if user liked
            const { data: userInterest } = await supabase
                .from('event_interests')
                .select('id')
                .eq('event_id', eventId)
                .eq('user_id', session.user.id)
                .maybeSingle();

            setLiked(!!userInterest);
        };

        fetchInterest();

        // Subscribe to changes
        const channel = supabase
            .channel(`event-interests-${eventId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'event_interests',
                    filter: `event_id=eq.${eventId}`
                },
                () => {
                    fetchInterest();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [eventId]);

    const toggleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!userId) {
            toast.error("Please sign in to like events");
            return;
        }

        setLoading(true);
        try {
            if (liked) {
                // Unlike
                const { error } = await supabase
                    .from('event_interests')
                    .delete()
                    .eq('event_id', eventId)
                    .eq('user_id', userId);

                if (error) throw error;
                setLiked(false);
                setCount(prev => Math.max(0, prev - 1));
            } else {
                // Like
                const { error } = await supabase
                    .from('event_interests')
                    .insert({
                        event_id: eventId,
                        user_id: userId
                    });

                if (error) throw error;
                setLiked(true);
                setCount(prev => prev + 1);
                toast.success("Added to your interests!");
            }
        } catch (error) {
            toast.error("Failed to update interest");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "gap-1.5 px-2 hover:bg-red-50 hover:text-red-600 transition-colors",
                liked && "text-red-600 bg-red-50"
            )}
            onClick={toggleLike}
            disabled={loading}
        >
            <Heart className={cn("w-4 h-4", liked && "fill-current")} />
            <span className="text-xs font-medium">{count}</span>
        </Button>
    );
};
