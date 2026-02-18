import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Upload, User } from "lucide-react";
import { PhotoEditorDialog } from "@/components/PhotoEditorDialog";

import { ImportCalendarDialog } from "@/components/ImportCalendarDialog";
import { Calendar } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type Profile = Database['public']['Tables']['profiles']['Row'];

interface InviteDetails {
  ride_id: string;
  expires_at: string;
  max_uses: number | null;
  use_count: number;
  inviter_name: string | null;
  invited_email: string | null;
  ride_groups?: {
    departure_time: string;
    event_id: string;
    capacity: number;
    events: {
      name: string;
      destination: string;
    };
  };
}

const Onboarding = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [step, setStep] = useState<'photo' | 'calendar' | 'invite'>('photo');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');

    const handleSession = async (session: any) => {
      if (!session) {
        navigate("/auth");
        return;
      }

      let inviteData = null;
      if (token) {
        setInviteToken(token);
        inviteData = await validateAndFetchInvite(token);
      }

      fetchProfile(session.user.id, inviteData, token);
    };

    // Listen for auth state changes (handles OAuth callback code exchange)
    let handled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!handled) {
          handled = true;
          handleSession(session);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateAndFetchInvite = async (token: string) => {
    try {
      // First, fetch just the invite record (no nested joins to avoid RLS issues)
      const { data: invite, error: inviteError } = await supabase
        .from('ride_invites')
        .select('ride_id, expires_at, max_uses, use_count, inviter_name, invited_email')
        .eq('invite_token', token)
        .single();

      if (inviteError || !invite) {
        toast.error("Invalid invite link");
        navigate('/auth');
        return null;
      }

      // Check if invite is expired
      if (new Date(invite.expires_at) < new Date()) {
        toast.error("This invite link has expired");
        navigate('/auth');
        return null;
      }

      // Check if invite has reached max uses
      if (invite.max_uses && invite.use_count >= invite.max_uses) {
        toast.error("This invite link has been fully used");
        navigate('/auth');
        return null;
      }

      // Separately fetch ride and event details (public data)
      const { data: rideGroup } = await supabase
        .from('ride_groups')
        .select('departure_time, event_id, capacity, events(name, destination)')
        .eq('id', invite.ride_id)
        .single();

      // Check if ride has already departed
      if (rideGroup && new Date(rideGroup.departure_time) < new Date()) {
        toast.error("This ride has already departed");
        navigate('/auth');
        return null;
      }

      // Combine the data for display
      const inviteWithDetails = {
        ...invite,
        ride_groups: rideGroup
      };

      setInviteDetails(inviteWithDetails);
      return inviteWithDetails;
    } catch (error) {
      toast.error("Failed to validate invite link");
      navigate('/auth');
      return null;
    }
  };

  const processInviteJoin = async () => {
    if (!inviteToken || !inviteDetails || !profile) {
      return false;
    }

    try {
      setUploading(true); // Reuse uploading state for loading UI

      // Step 1: Verify email match if invited_email is set
      if (inviteDetails.invited_email) {
        const normalizedInviteEmail = inviteDetails.invited_email.toLowerCase().trim();
        const normalizedProfileEmail = profile.email?.toLowerCase().trim();

        if (normalizedInviteEmail !== normalizedProfileEmail) {
          toast.error(`This invite is for ${inviteDetails.invited_email}. Please sign in with that email.`);
          setUploading(false);
          return false;
        }
      }

      // Step 2: Update profile FIRST (critical for RLS)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_invited_user: true,
          invited_via_ride_id: inviteDetails.ride_id
        })
        .eq('id', profile.id);

      if (profileError) {
        toast.error("Failed to process invite");
        setUploading(false);
        return false;
      }

      // Step 3: Check if user is already a member
      const { data: existingMember } = await supabase
        .from('ride_members')
        .select('id')
        .eq('ride_id', inviteDetails.ride_id)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingMember) {
        toast.info("You're already a member of this ride");
        navigate(`/rides/${inviteDetails.ride_id}`);
        return true;
      }

      // Step 4: Check capacity
      const { data: currentMembers } = await supabase
        .from('ride_members')
        .select('id')
        .eq('ride_id', inviteDetails.ride_id);

      const memberCount = currentMembers?.length || 0;
      const capacity = inviteDetails.ride_groups?.capacity;

      if (capacity && memberCount >= capacity) {
        toast.error("This ride is at full capacity");
        setUploading(false);
        return false;
      }

      // Step 5: Insert into ride_members (now passes RLS)
      const { error: joinError } = await supabase
        .from('ride_members')
        .insert({
          ride_id: inviteDetails.ride_id,
          user_id: profile.id,
          status: 'joined',
          role: null,
          willing_to_pay: false
        });

      if (joinError) {
        toast.error("Failed to join ride");
        setUploading(false);
        return false;
      }

      // Step 6: Grant event access
      if (inviteDetails.ride_groups?.event_id) {
        await supabase
          .from('event_access')
          .insert({
            user_id: profile.id,
            event_id: inviteDetails.ride_groups.event_id,
            granted_via_ride_id: inviteDetails.ride_id
          });
      }

      // Step 7: Increment invite use count
      await supabase
        .from('ride_invites')
        .update({ use_count: inviteDetails.use_count + 1 })
        .eq('invite_token', inviteToken);

      toast.success("Successfully joined the ride!");
      navigate(`/rides/${inviteDetails.ride_id}`);
      return true;
    } catch (error) {
      toast.error("Failed to process invite");
      return false;
    } finally {
      setUploading(false);
    }
  };

  const fetchProfile = async (userId: string, currentInviteDetails?: InviteDetails | null, tokenFromUrl?: string | null) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setProfile(data);
      setPhotoUrl(data.photo || null);

      // Auto-update is_invited_user flag based on email domain
      const isExternal = !data.email?.toLowerCase().endsWith('@berkeley.edu');
      if (data.is_invited_user !== isExternal) {
        await supabase
          .from('profiles')
          .update({ is_invited_user: isExternal })
          .eq('id', userId);

        // Update local state
        setProfile({ ...data, is_invited_user: isExternal });
      }

      // If user already has a photo
      if (data.photo) {
        // If there's an invite token, show the invite step
        // Use tokenFromUrl param to avoid React state timing issues
        const hasToken = tokenFromUrl || inviteToken;
        const inviteToProcess = currentInviteDetails || inviteDetails;
        if (hasToken && inviteToProcess) {
          setStep('invite');
          return;
        }

        // Otherwise go to calendar step
        setStep('calendar');
      }
    } catch (error) {
      toast.error("Failed to load profile");
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    // Open editor dialog
    setSelectedFile(file);
    setEditorOpen(true);
  };

  const handleSaveCroppedPhoto = async (croppedBlob: Blob) => {
    if (!profile) return;

    try {
      setUploading(true);

      // Upload cropped photo
      const fileName = `${Date.now()}.png`;
      const filePath = `${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, croppedBlob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      // Update profile with new photo URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setPhotoUrl(publicUrl);
      setProfile({ ...profile, photo: publicUrl });
      setEditorOpen(false);
      setSelectedFile(null);
      toast.success("Profile photo added successfully");

      // If we have an invite, go to invite step, else calendar
      if (inviteToken && inviteDetails) {
        setStep('invite');
      } else {
        setStep('calendar');
      }
    } catch (error) {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleCompleteSetup = async () => {
    // If we are in photo step and have a photo, move to calendar
    if (step === 'photo' && photoUrl) {
      if (inviteToken && inviteDetails) {
        setStep('invite');
      } else {
        setStep('calendar');
      }
      return;
    }

    // If we are in calendar step, we can proceed

    try {
      // Process invite token if present
      if (inviteToken && inviteDetails) {
        // If they skipped the invite, we don't process it here.
        // Just route them to the app.
        // Check if external user
        const isExternalUser = !profile.email?.toLowerCase().endsWith('@berkeley.edu');

        // Priority 1 - Check for upcoming rides
        const { data: upcomingRides } = await supabase
          .from('ride_members')
          .select(`
            ride_id,
            ride_groups!inner(
              id,
              departure_time
            )
          `)
          .eq('user_id', profile.id)
          .gte('ride_groups.departure_time', new Date().toISOString())
          .limit(1);

        if (upcomingRides && upcomingRides.length > 0) {
          navigate('/my-rides');
          return;
        }

        // Priority 2 - External users always go to My Rides
        if (isExternalUser) {
          navigate('/my-rides');
          return;
        }

        // Priority 3 - Berkeley users go to Events (which will be My Events)
        navigate("/events");
        return;
      }

      // Check if external user
      const isExternalUser = !profile.email?.toLowerCase().endsWith('@berkeley.edu');

      // Priority 1 - Check for upcoming rides
      const { data: upcomingRides } = await supabase
        .from('ride_members')
        .select(`
          ride_id,
          ride_groups!inner(
            id,
            departure_time
          )
        `)
        .eq('user_id', profile.id)
        .gte('ride_groups.departure_time', new Date().toISOString())
        .limit(1);

      if (upcomingRides && upcomingRides.length > 0) {
        navigate('/my-rides');
        return;
      }

      // Priority 2 - External users always go to My Rides
      if (isExternalUser) {
        navigate('/my-rides');
        return;
      }

      // Priority 3 - Berkeley users go to Events (which will be My Events)
      navigate("/events");
    } catch (error) {
      navigate("/my-rides");
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-primary">
            {step === 'photo' ? 'Welcome!' : step === 'invite' ? 'Join Ride?' : 'Sync Your Schedule'}
          </h2>
          <p className="text-muted-foreground">
            {step === 'photo'
              ? 'One last step - add your profile photo'
              : step === 'invite'
                ? 'You have been invited to a ride!'
                : 'Import your calendar to find rides for your events'}
          </p>
        </div>

        {/* Invite Card for Photo Step */}
        {step === 'photo' && inviteDetails && (
          <Card className="mb-4 bg-primary/5 border-primary">
            <CardContent className="pt-6">
              <p className="text-sm font-medium mb-1">🎉 You're invited!</p>
              <p className="text-sm text-muted-foreground">
                {inviteDetails.inviter_name || 'A Berkeley student'} invited you to join their ride to{' '}
                <span className="font-medium text-foreground">
                  {inviteDetails.ride_groups?.events?.destination}
                </span>
              </p>
            </CardContent>
          </Card>
        )}

        {step === 'invite' && inviteDetails ? (
          <Card>
            <CardHeader>
              <CardTitle>Ride Invitation</CardTitle>
              <CardDescription>
                {inviteDetails.inviter_name || 'A Berkeley student'} invited you to join this ride.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{inviteDetails.ride_groups?.events?.destination}</p>
                    <p className="text-sm text-muted-foreground">
                      {inviteDetails.ride_groups?.events?.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">
                      {new Date(inviteDetails.ride_groups?.departure_time).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">Departure Time</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={processInviteJoin}
                  size="lg"
                  className="w-full"
                  disabled={uploading}
                >
                  {uploading ? "Joining..." : "Accept & Join Ride"}
                </Button>

                <Button
                  onClick={handleCompleteSetup} // This will route based on profile/existing rides
                  variant="ghost"
                  className="w-full"
                  disabled={uploading}
                >
                  No thanks, just take me to the app
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : step === 'photo' ? (
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Profile</CardTitle>
              <CardDescription>
                Help others recognize you in ride groups by adding a profile photo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <Avatar className="w-32 h-32 ring-4 ring-primary/20">
                  <AvatarImage src={photoUrl || undefined} alt={profile.name} />
                  <AvatarFallback className="text-4xl bg-secondary">
                    {photoUrl ? (
                      <User className="w-12 h-12" />
                    ) : (
                      profile.name?.charAt(0)?.toUpperCase() || 'U'
                    )}
                  </AvatarFallback>
                </Avatar>

                <div className="text-center">
                  <p className="font-medium text-lg">{profile.name}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  <p className="text-sm text-muted-foreground">{profile.program}</p>
                </div>

                <label htmlFor="photo-upload" className="w-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={uploading}
                    className="w-full"
                    asChild
                  >
                    <span>
                      <Upload className="w-5 h-5 mr-2" />
                      {uploading ? "Uploading..." : photoUrl ? "Change Photo" : "Upload Photo"}
                    </span>
                  </Button>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                  />
                </label>
              </div>

              <Button
                onClick={() => {
                  if (inviteToken && inviteDetails) {
                    setStep('invite');
                  } else {
                    setStep('calendar');
                  }
                }}
                disabled={!photoUrl || uploading}
                size="lg"
                className="w-full"
              >
                Continue
              </Button>

              {!photoUrl && (
                <p className="text-sm text-center text-muted-foreground">
                  A profile photo is required to continue
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Import Calendar</CardTitle>
              <CardDescription>
                Connect your calendar to automatically find rides for your upcoming events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Calendar className="w-12 h-12 text-primary" />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  We'll scan your calendar for events and match you with other students going to the same places.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => setImportDialogOpen(true)}
                  size="lg"
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import from .ICS File
                </Button>

                <Button
                  onClick={handleCompleteSetup}
                  variant="ghost"
                  className="w-full"
                >
                  Skip for now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ImportCalendarDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onEventsImported={handleCompleteSetup}
      />

      <PhotoEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        imageFile={selectedFile}
        onSave={handleSaveCroppedPhoto}
        onCancel={() => {
          setEditorOpen(false);
          setSelectedFile(null);
        }}
      />
    </div>
  );
};

export default Onboarding;
