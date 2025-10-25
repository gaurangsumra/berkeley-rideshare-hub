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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
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
      setPhotoUrl(data.photo || null);

      // If user already has a photo, redirect to events
      if (data.photo) {
        navigate("/events");
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

  const handleCompleteSetup = () => {
    if (!photoUrl) {
      toast.error("Please upload a profile photo to continue");
      return;
    }
    
    if (profile.is_invited_user && profile.invited_via_ride_id) {
      supabase
        .from('ride_groups')
        .select('event_id')
        .eq('id', profile.invited_via_ride_id)
        .single()
        .then(({ data }) => {
          if (data?.event_id) {
            navigate(`/events/${data.event_id}`);
          } else {
            navigate("/events");
          }
        });
    } else {
      navigate("/events");
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
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-primary">Welcome to Berkeley Rides</h1>
          <p className="text-muted-foreground">One last step - add your profile photo</p>
        </div>

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
