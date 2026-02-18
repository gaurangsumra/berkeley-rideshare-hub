import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { toast } from "sonner";

interface UserDetail {
  id: string;
  name: string;
  email: string;
  program: string;
  photo: string | null;
  venmo_username: string | null;
  created_at: string;
  is_invited_user: boolean;
}

interface UserDetailSheetProps {
  user: UserDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserDetailSheet = ({ user, open, onOpenChange }: UserDetailSheetProps) => {
  const [currentRole, setCurrentRole] = useState<string>("user");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [rideCount, setRideCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && open) {
      fetchUserDetails(user.id);
    }
  }, [user, open]);

  const fetchUserDetails = async (userId: string) => {
    const [{ data: roles }, { data: rides }, { data: ratings }] = await Promise.all([
      supabase.from('user_roles').select('id, role').eq('user_id', userId),
      supabase.from('ride_members').select('id').eq('user_id', userId).eq('status', 'joined'),
      supabase.from('user_ratings').select('rating').eq('rated_user_id', userId),
    ]);

    if (roles && roles.length > 0) {
      setCurrentRole(roles[0].role);
      setRoleId(roles[0].id);
    } else {
      setCurrentRole("user");
      setRoleId(null);
    }

    setRideCount(rides?.length || 0);

    const validRatings = ratings?.map(r => r.rating).filter((r): r is number => r !== null) || [];
    setAvgRating(validRatings.length > 0
      ? Math.round((validRatings.reduce((a, b) => a + b, 0) / validRatings.length) * 10) / 10
      : 0
    );
  };

  const handleRoleChange = async (newRole: string) => {
    if (!user) return;
    setSaving(true);
    try {
      if (roleId) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole as "admin" | "moderator" | "user" })
          .eq('id', roleId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: newRole as "admin" | "moderator" | "user" })
          .select('id')
          .single();
        if (error) throw error;
        setRoleId(data.id);
      }
      setCurrentRole(newRole);
      toast.success(`Role updated to ${newRole}`);
    } catch (error) {
      toast.error("Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>User Details</SheetTitle>
          <SheetDescription>View and manage user profile</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={user.photo || undefined} />
              <AvatarFallback className="text-lg">{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Program</p>
              <p className="text-sm font-medium">{user.program || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <Badge variant={user.is_invited_user ? "secondary" : "default"}>
                {user.is_invited_user ? 'Invited' : 'Berkeley'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Joined</p>
              <p className="text-sm font-medium">{format(new Date(user.created_at), 'MMM d, yyyy')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Venmo</p>
              <p className="text-sm font-medium">{user.venmo_username || 'Not set'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rides Joined</p>
              <p className="text-sm font-medium">{rideCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Rating</p>
              <p className="text-sm font-medium">{avgRating > 0 ? avgRating : 'No ratings'}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Role Management</p>
            <Select value={currentRole} onValueChange={handleRoleChange} disabled={saving}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Changes take effect immediately
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
