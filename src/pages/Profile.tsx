import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navigation } from "@/components/Navigation";
import { toast } from "sonner";
import { LogOut, User, Upload, X, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhotoEditorDialog } from "@/components/PhotoEditorDialog";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  program: string | null;
  venmo_username: string | null;
  is_invited_user: boolean | null;
}

interface RideStats {
  completed_rides: number;
  completion_percentage: number;
}

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [program, setProgram] = useState("");
  const [venmoUsername, setVenmoUsername] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [stats, setStats] = useState<RideStats | null>(null);
  const [weightedRating, setWeightedRating] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user has completed onboarding
      const { data: profileData } = await supabase
        .from('profiles')
        .select('photo')
        .eq('id', session.user.id)
        .single();

      if (!profileData?.photo) {
        navigate("/onboarding");
        return;
      }

      fetchProfile(session.user.id);
    });
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
      setProgram(data.program || "");
      setVenmoUsername(data.venmo_username || "");
      setPhotoUrl(data.photo || null);

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
    } catch (error) {
      toast.error("Failed to load profile");
    }
  };

  const handleUpdateProgram = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({ program })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success("Program updated successfully");
    } catch (error) {
      toast.error("Failed to update program");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVenmo = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({ venmo_username: venmoUsername })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success("Venmo username updated successfully");
    } catch (error) {
      toast.error("Failed to update Venmo username");
    } finally {
      setLoading(false);
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

    // Open editor dialog instead of immediate upload
    setSelectedFile(file);
    setEditorOpen(true);
  };

  const handleSaveCroppedPhoto = async (croppedBlob: Blob) => {
    if (!profile) return;

    try {
      setUploading(true);

      // Delete old photo if exists
      if (profile.photo) {
        const oldPath = profile.photo.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('profile-photos')
            .remove([`${profile.id}/${oldPath}`]);
        }
      }

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
      toast.success("Profile photo updated successfully");
    } catch (error) {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!profile?.photo) return;

    try {
      setUploading(true);

      // Delete from storage
      const oldPath = profile.photo.split('/').pop();
      if (oldPath) {
        const { error: deleteError } = await supabase.storage
          .from('profile-photos')
          .remove([`${profile.id}/${oldPath}`]);

        if (deleteError) throw deleteError;
      }

      // Update profile to remove photo URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo: null })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setPhotoUrl(null);
      setProfile({ ...profile, photo: null });
      toast.success("Profile photo removed");
    } catch (error) {
      toast.error("Failed to delete photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary">Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Your Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-4 pb-4 border-b">
              <Avatar className="w-24 h-24">
                <AvatarImage src={photoUrl || undefined} alt={`${profile.name}'s profile photo`} />
                <AvatarFallback className="text-2xl">
                  {profile.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <label htmlFor="photo-upload">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    disabled={uploading}
                    asChild
                  >
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? "Uploading..." : "Upload Photo"}
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
                {photoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePhotoDelete}
                    disabled={uploading}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={profile.name} disabled className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={profile.email} disabled className="mt-1" />
            </div>
            {!profile.is_invited_user && (
              <div>
                <Label htmlFor="program">Program</Label>
                <Input
                  id="program"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  placeholder="e.g., Haas MBA, MEng, Undergraduate"
                  className="mt-1"
                />
                <Button
                  onClick={handleUpdateProgram}
                  disabled={loading || program === profile.program}
                  className="mt-2"
                >
                  Update Program
                </Button>
              </div>
            )}
            <div>
              <Label htmlFor="venmo">Venmo Username (Optional)</Label>
              <Input
                id="venmo"
                value={venmoUsername}
                onChange={(e) => setVenmoUsername(e.target.value)}
                placeholder="e.g., @yourvenmo"
                className="mt-1"
              />
              <Button
                onClick={handleUpdateVenmo}
                disabled={loading || venmoUsername === profile.venmo_username}
                className="mt-2"
              >
                Update Venmo
              </Button>
            </div>
            {profile.is_invited_user && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  👥 <strong>Guest User</strong> - Invited to Berkeley Rides
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Ride Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Completed Rides</span>
              <span className="font-semibold">{stats?.completed_rides || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Completion Rate</span>
              <span className="font-semibold">{stats?.completion_percentage || 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">User Rating</span>
              {weightedRating !== null ? (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{weightedRating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">/ 5.0</span>
                </div>
              ) : (
                <span className="font-semibold text-muted-foreground">N/A</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleSignOut}
          variant="destructive"
          className="w-full"
          size="lg"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <Navigation />

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

export default Profile;