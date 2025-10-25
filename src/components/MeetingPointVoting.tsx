import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { MapPin, Plus, X } from "lucide-react";

const DEFAULT_OPTIONS = [
  "Haas Courtyard",
  "Downtown Berkeley BART",
  "Clark Kerr Campus"
];

interface MeetingPointVotingProps {
  rideId: string;
  currentMeetingPoint: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

export const MeetingPointVoting = ({
  rideId,
  currentMeetingPoint,
  onClose,
  onUpdate
}: MeetingPointVotingProps) => {
  const [options, setOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const [customOption, setCustomOption] = useState("");
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchVotes();
  }, [rideId]);

  const fetchVotes = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('meeting_votes')
        .select('*')
        .eq('ride_id', rideId);

      if (error) throw error;

      const voteCounts: Record<string, number> = {};
      const userVotes: string[] = [];
      const allOptions = new Set(DEFAULT_OPTIONS);

      data?.forEach(vote => {
        allOptions.add(vote.vote_option);
        voteCounts[vote.vote_option] = (voteCounts[vote.vote_option] || 0) + 1;
        if (vote.user_id === session.user.id) {
          userVotes.push(vote.vote_option);
        }
      });

      setOptions(Array.from(allOptions));
      setVotes(voteCounts);
      setMyVotes(userVotes);
    } catch (error: any) {
      toast.error("Failed to load votes");
    }
  };

  const handleAddCustomOption = () => {
    if (!customOption.trim()) return;
    if (options.includes(customOption.trim())) {
      toast.error("This option already exists");
      return;
    }
    setOptions([...options, customOption.trim()]);
    setCustomOption("");
  };

  const handleToggleVote = async (option: string) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (myVotes.includes(option)) {
        const { error } = await supabase
          .from('meeting_votes')
          .delete()
          .eq('ride_id', rideId)
          .eq('user_id', session.user.id)
          .eq('vote_option', option);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('meeting_votes')
          .insert({
            ride_id: rideId,
            user_id: session.user.id,
            vote_option: option
          });

        if (error) throw error;
      }

      await fetchVotes();
      
      // Auto-update meeting point to highest voted option
      await autoUpdateMeetingPoint();
    } catch (error: any) {
      toast.error("Failed to update vote");
    } finally {
      setLoading(false);
    }
  };

  const autoUpdateMeetingPoint = async () => {
    try {
      console.log('Starting auto-update meeting point...');
      
      // Fetch latest votes
      const { data, error } = await supabase
        .from('meeting_votes')
        .select('vote_option')
        .eq('ride_id', rideId);

      if (error) {
        console.error('Error fetching votes:', error);
        throw error;
      }

      console.log('Vote data:', data);

      // Calculate winner
      const voteCounts: Record<string, number> = {};
      data?.forEach(vote => {
        voteCounts[vote.vote_option] = (voteCounts[vote.vote_option] || 0) + 1;
      });

      console.log('Vote counts:', voteCounts);

      const sortedOptions = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
      const winner = sortedOptions[0];
      
      console.log('Current meeting point:', currentMeetingPoint);
      console.log('Winner:', winner);
      
      if (winner) {
        console.log('Updating meeting point to:', winner[0]);
        
        // Always update to ensure it reflects the highest votes
        const { error: updateError } = await supabase
          .from('ride_groups')
          .update({ meeting_point: winner[0] })
          .eq('id', rideId);

        if (updateError) {
          console.error('Error updating meeting point:', updateError);
          throw updateError;
        }
        
        console.log('Meeting point updated successfully');
        toast.success(`Meeting point updated to: ${winner[0]}`);
        onUpdate();
      }
    } catch (error: any) {
      console.error("Failed to auto-update meeting point:", error);
      toast.error("Failed to update meeting point automatically");
    }
  };

  const handleConfirmWinner = async () => {
    const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    if (!winner) {
      toast.error("No votes cast yet");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('ride_groups')
        .update({ meeting_point: winner[0] })
        .eq('id', rideId);

      if (error) throw error;
      toast.success(`Meeting point set to: ${winner[0]}`);
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error("Failed to set meeting point");
    } finally {
      setLoading(false);
    }
  };

  const topVote = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Vote for Meeting Point
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          {currentMeetingPoint && (
            <p className="text-sm text-muted-foreground">
              Current:{' '}
              <a 
                href={`https://www.google.com/maps?q=${encodeURIComponent(currentMeetingPoint)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary hover:underline transition-colors"
              >
                {currentMeetingPoint}
              </a>
            </p>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {options.map((option) => (
              <div
                key={option}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Checkbox
                    checked={myVotes.includes(option)}
                    onCheckedChange={() => handleToggleVote(option)}
                    disabled={loading}
                  />
                  <a 
                    href={`https://www.google.com/maps?q=${encodeURIComponent(option)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:text-primary hover:underline transition-colors"
                  >
                    {option}
                  </a>
                </div>
                <Badge variant="outline">
                  {votes[option] || 0} votes
                </Badge>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add custom location"
              value={customOption}
              onChange={(e) => setCustomOption(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCustomOption()}
            />
            <Button onClick={handleAddCustomOption} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {topVote && (
            <div className="p-3 bg-primary/5 rounded-lg">
              <p className="text-sm font-medium text-primary">
                Leading:{' '}
                <a 
                  href={`https://www.google.com/maps?q=${encodeURIComponent(topVote[0])}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {topVote[0]}
                </a>
                {' '}({topVote[1]} votes)
              </p>
            </div>
          )}

          <Button
            onClick={handleConfirmWinner}
            disabled={loading || !topVote}
            className="w-full"
          >
            Confirm Meeting Point
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

import { Badge } from "@/components/ui/badge";