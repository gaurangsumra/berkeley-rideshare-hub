import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navigation } from "@/components/Navigation";
import { toast } from "sonner";
import { LogOut, User, Upload, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [program, setProgram] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
      }
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
      setPhotoUrl(data.photo || null);
    } catch (error: any) {
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
    } catch (error: any) {
      toast.error("Failed to update program");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

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

      // Upload new photo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file);

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
      toast.success("Profile photo updated successfully");
    } catch (error: any) {
      console.error('Upload error:', error);
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
    } catch (error: any) {
      console.error('Delete error:', error);
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
                <AvatarImage src={photoUrl || undefined} alt={profile.name} />
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
    </div>
  );
};

export default Profile;