import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogOut, User, Mail, Phone, Briefcase } from "lucide-react";

interface Profile {
  full_name: string;
  email: string;
  phone: string | null;
}

interface UserRole {
  role: string;
}

const Profile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("user_id", user.id)
      .single();

    // Fetch user role from user_roles table
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }
    if (roleData) {
      setUserRole(roleData);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
      })
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-primary-foreground/90">Manage your account</p>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  value={profile.full_name}
                  onChange={(e) =>
                    setProfile({ ...profile, full_name: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value })
                  }
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Role
                </Label>
                <Input
                  id="role"
                  value={userRole?.role || "No role assigned"}
                  disabled
                  className="bg-muted capitalize"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Button
          onClick={handleLogout}
          variant="destructive"
          className="w-full"
          size="lg"
        >
          <LogOut className="mr-2 h-5 w-5" />
          Logout
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;