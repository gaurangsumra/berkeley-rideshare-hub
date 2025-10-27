import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Upload, User } from "lucide-react";
import { PhotoEditorDialog } from "@/components/PhotoEditorDialog";


const Onboarding = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<any>(null);

  useEffect(() => {
    const initializeOnboarding = async () => {
      // Extract invite token from URL
      const params = new URLSearchParams(window.location.search);
      const token = params.get('invite');
      
      // Step 1: Get session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Step 2: If invite token exists, validate it FIRST and get the details
      let inviteData = null;
      if (token) {
        setInviteToken(token);
        inviteData = await validateAndFetchInvite(token);
      }

      // Step 3: Pass invite data directly to fetchProfile
      fetchProfile(session.user.id, inviteData);
    };

    initializeOnboarding();
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
        console.error('Invite not found:', inviteError);
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
      console.log('Invite validated successfully:', inviteWithDetails);
      console.log('Event ID from invite:', rideGroup?.event_id);
      return inviteWithDetails;
    } catch (error) {
      console.error('Error validating invite:', error);
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
      console.log('Processing invite join for ride:', inviteDetails.ride_id);

      // Step 1: Verify email match if invited_email is set
      if (inviteDetails.invited_email) {
        const normalizedInviteEmail = inviteDetails.invited_email.toLowerCase().trim();
        const normalizedProfileEmail = profile.email?.toLowerCase().trim();
        
        if (normalizedInviteEmail !== normalizedProfileEmail) {
          toast.error(`This invite is for ${inviteDetails.invited_email}. Please sign in with that email.`);
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
        console.error('Failed to update profile:', profileError);
        toast.error("Failed to process invite");
        return false;
      }

      console.log('Profile updated with invite info');

      // Step 3: Check if user is already a member
      const { data: existingMember } = await supabase
        .from('ride_members')
        .select('id')
        .eq('ride_id', inviteDetails.ride_id)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingMember) {
        toast.info("You're already a member of this ride");
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
        console.error('Join error:', joinError);
        toast.error("Failed to join ride");
        return false;
      }

      console.log('Successfully joined ride');

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
      return true;
    } catch (error) {
      console.error('Error processing invite:', error);
      toast.error("Failed to process invite");
      return false;
    }
  };

  const fetchProfile = async (userId: string, currentInviteDetails?: any) => {
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

      // If user already has a photo, onboarding is complete
      if (data.photo) {
        // If there's an invite token, process it immediately using passed-in details
        const inviteToProcess = currentInviteDetails || inviteDetails;
        if (inviteToken && inviteToProcess) {
          const joined = await processInviteJoin();
          if (joined) {
            // Get event_id - use passed-in details first
            let eventId = inviteToProcess.ride_groups?.event_id;
            
            // Fallback: if event_id is missing, fetch it directly
            if (!eventId && inviteToProcess.ride_id) {
              console.log('Event ID missing from invite details, fetching directly...');
              const { data: rideData } = await supabase
                .from('ride_groups')
                .select('event_id')
                .eq('id', inviteToProcess.ride_id)
                .single();
              
              eventId = rideData?.event_id;
              console.log('Fetched event_id:', eventId);
            }
            
            if (eventId) {
              console.log('Redirecting to event:', eventId);
              navigate(`/events/${eventId}`);
              return;
            } else {
              console.error('Could not determine event_id for redirect');
              navigate("/my-rides");
              return;
            }
          }
        }
        
        // Otherwise redirect appropriately
        if (isExternal) {
          navigate("/my-rides");
        } else {
          navigate("/events");
        }
      }
    } catch (error: any) {
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
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleCompleteSetup = async () => {
    if (!photoUrl) {
      toast.error("Please upload a profile photo to continue");
      return;
    }
    
    try {
      // Process invite token if present
      if (inviteToken && inviteDetails) {
        const joined = await processInviteJoin();
        if (joined) {
          let eventId = inviteDetails.ride_groups?.event_id;
          
          if (!eventId && inviteDetails.ride_id) {
            const { data: rideData } = await supabase
              .from('ride_groups')
              .select('event_id')
              .eq('id', inviteDetails.ride_id)
              .single();
            eventId = rideData?.event_id;
          }
          
          if (eventId) {
            navigate(`/events/${eventId}`);
          } else {
            navigate('/my-rides');
          }
        }
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
      
      // Priority 3 - Berkeley users go to Events
      navigate("/events");
    } catch (error) {
      console.error('Error determining route:', error);
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
          <h2 className="text-3xl font-bold text-primary">Welcome!</h2>
          <p className="text-muted-foreground">One last step - add your profile photo</p>
        </div>

        {inviteDetails && (
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
              onClick={handleCompleteSetup}
              disabled={!photoUrl || uploading}
              size="lg"
              className="w-full"
            >
              Complete Setup
            </Button>

            {!photoUrl && (
              <p className="text-sm text-center text-muted-foreground">
                A profile photo is required to continue
              </p>
            )}
          </CardContent>
        </Card>
      </div>

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
