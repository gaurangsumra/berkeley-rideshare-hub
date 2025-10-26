import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Users, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PostRidePaymentDialog } from "./PostRidePaymentDialog";

interface RideMember {
  user_id: string;
  profiles: {
    name: string;
    photo: string | null;
  };
}

interface Survey {
  id: string;
  ride_id: string;
  survey_deadline: string;
  total_members: number;
  responses_received: number;
}

interface AttendanceSurveyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  eventName: string;
  onSubmitted?: () => void;
}

export const AttendanceSurveyDialog = ({
  open,
  onOpenChange,
  rideId,
  eventName,
  onSubmitted,
}: AttendanceSurveyDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [members, setMembers] = useState<RideMember[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [respondents, setRespondents] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [rideDetails, setRideDetails] = useState<any>(null);

  useEffect(() => {
    if (open && rideId) {
      fetchSurveyData();
    }
  }, [open, rideId]);

  const fetchSurveyData = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setCurrentUserId(session.user.id);

      // Fetch survey
      const { data: surveyData, error: surveyError } = await supabase
        .from('ride_attendance_surveys')
        .select(`
          *,
          ride_attendance_responses(respondent_user_id)
        `)
        .eq('ride_id', rideId)
        .single();

      if (surveyError) throw surveyError;

      setSurvey(surveyData);
      setRespondents(
        surveyData.ride_attendance_responses?.map((r: any) => r.respondent_user_id) || []
      );

      // Fetch ride members
      const { data: membersData, error: membersError } = await supabase
        .from('ride_members')
        .select(`
          user_id,
          profiles:user_id(name, photo)
        `)
        .eq('ride_id', rideId)
        .eq('status', 'joined');

      if (membersError) throw membersError;

      setMembers(membersData || []);
    } catch (error: any) {
      console.error('Error fetching survey data:', error);
      toast.error('Failed to load survey');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMember = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const handleSubmit = async () => {
    if (!survey || !currentUserId) return;

    try {
      setSubmitting(true);

      // Insert response
      const { error: responseError } = await supabase
        .from('ride_attendance_responses')
        .insert({
          survey_id: survey.id,
          ride_id: rideId,
          respondent_user_id: currentUserId,
          attended_user_ids: Array.from(selectedUserIds),
        });

      if (responseError) throw responseError;

      // Update response count
      const newResponseCount = survey.responses_received + 1;
      await supabase
        .from('ride_attendance_surveys')
        .update({ responses_received: newResponseCount })
        .eq('id', survey.id);

      // Check if threshold reached (50%)
      const threshold = Math.ceil(survey.total_members * 0.5);
      if (newResponseCount >= threshold) {
        console.log('Threshold reached, triggering consensus processing');
        await supabase.functions.invoke('process-attendance-consensus', {
          body: { survey_id: survey.id }
        });
      }

      // Check if user marked themselves as attended
      if (selectedUserIds.has(currentUserId)) {
        // Fetch ride details to determine payer/driver
        const { data: rideData } = await supabase
          .from('ride_groups')
          .select(`
            travel_mode,
            events(name),
            ride_members(user_id, role, willing_to_pay, profiles(id, name, photo, program))
          `)
          .eq('id', rideId)
          .single();
        
        if (rideData) {
          // Determine who should enter payment
          const payerCandidate = rideData.ride_members.find((m: any) => m.willing_to_pay);
          const driver = rideData.ride_members.find((m: any) => m.role === 'driver');
          
          const shouldEnterPayment = 
            (payerCandidate?.user_id === currentUserId) || 
            (driver?.user_id === currentUserId && rideData.travel_mode === 'Carpool (Student Driver)');
          
          if (shouldEnterPayment) {
            // Store ride details and open payment dialog
            setRideDetails(rideData);
            setShowPaymentDialog(true);
            toast.success('Response submitted. Please enter the payment amount.');
            onOpenChange(false);
            onSubmitted?.();
            return;
          }
        }
      }

      toast.success('Response submitted successfully');
      onOpenChange(false);
      onSubmitted?.();
    } catch (error: any) {
      console.error('Error submitting response:', error);
      toast.error(error.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!survey) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Survey Not Found</DialogTitle>
            <DialogDescription>
              This survey is no longer available.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Who showed up?</DialogTitle>
          <DialogDescription>
            Mark everyone who attended the ride to {eventName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Info */}
          <div className="flex items-center justify-between text-sm bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {survey.responses_received} of {survey.total_members} responded
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(survey.survey_deadline), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-2">
            {members.map((member) => {
              const hasResponded = respondents.includes(member.user_id);
              const isCurrentUser = member.user_id === currentUserId;
              
              return (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedUserIds.has(member.user_id)}
                    onCheckedChange={() => handleToggleMember(member.user_id)}
                    disabled={hasResponded && !isCurrentUser}
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.profiles.photo || undefined} />
                    <AvatarFallback>
                      {member.profiles.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">
                      {member.profiles.name}
                      {isCurrentUser && " (You)"}
                    </p>
                    {hasResponded && !isCurrentUser && (
                      <p className="text-xs text-muted-foreground">Already responded</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Respondents Info */}
          {respondents.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {respondents.length === 1 ? '1 person has' : `${respondents.length} people have`} already responded
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedUserIds.size === 0}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Response'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {showPaymentDialog && rideDetails && (
      <PostRidePaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        rideId={rideId}
        members={rideDetails.ride_members.map((m: any) => ({
          id: m.user_id,
          name: m.profiles.name,
          photo: m.profiles.photo,
          program: m.profiles.program,
        }))}
        currentUserId={currentUserId}
        travelMode={rideDetails.travel_mode}
        eventName={rideDetails.events.name}
      />
    )}
    </>
  );
};
