import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters").optional(),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [selectedRole, setSelectedRole] = useState<"staff" | "supervisor" | "manager" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const getRoleBasedRedirect = async (userId: string): Promise<string> => {
    console.log("🔍 getRoleBasedRedirect called for userId:", userId);
    
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    console.log("📊 Role query result:", { data, error });

    if (error) {
      console.error("❌ Error fetching user roles:", error);
      return "/"; // Default to staff page
    }

    const roles = (data?.map((r: { role: string }) => r.role) ?? []) as string[];
    console.log("👤 User roles:", roles);
    
    const redirectPath = (roles.includes("manager") || roles.includes("supervisor")) ? "/supervisor" : "/";
    console.log("🎯 Redirect path determined:", redirectPath);
    
    return redirectPath;
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const redirectPath = await getRoleBasedRedirect(session.user.id);
        navigate(redirectPath);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const redirectPath = await getRoleBasedRedirect(session.user.id);
        navigate(redirectPath);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validationData = isLogin 
        ? { email, password }
        : { email, password, fullName };
      
      authSchema.parse(validationData);
      
      setLoading(true);

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Login failed",
              description: "Invalid email or password. Please try again.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
          return;
        }

        toast({
          title: "Welcome back!",
          description: "You've successfully logged in.",
        });

        // Role-based redirect after login
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const redirectPath = await getRoleBasedRedirect(user.id);
          navigate(redirectPath);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "Account exists",
              description: "An account with this email already exists. Please login instead.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
          return;
        }

        if (data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              user_id: data.user.id,
              full_name: fullName.trim(),
              email: email.trim(),
            });

          if (profileError) {
            console.error("Profile creation error:", profileError);
          }

          toast({
            title: "Account created!",
            description: "Welcome to BMS Pro Field Staff.",
          });
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        console.error("Auth error:", error);
        toast({
          title: "Error",
          description: "An error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Show role selection first for login
  if (isLogin && !selectedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              BMS Pro Field Staff
            </CardTitle>
            <CardDescription className="text-center">
              Select your role to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setSelectedRole("staff")}
              className="w-full h-16 text-lg"
              variant="outline"
            >
              Staff Login
            </Button>
            <Button
              onClick={() => setSelectedRole("supervisor")}
              className="w-full h-16 text-lg"
              variant="outline"
            >
              Supervisor Login
            </Button>
            <Button
              onClick={() => setSelectedRole("manager")}
              className="w-full h-16 text-lg"
              variant="outline"
            >
              Manager Login
            </Button>
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className="text-primary hover:underline"
              >
                Don't have an account? Sign up
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background circles */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      
      <Card className="w-full max-w-md glass neuro-shadow animate-scale-in">
        <CardHeader className="space-y-3">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto animate-bounce-in shadow-lg">
            <span className="text-2xl font-bold text-primary-foreground">BMS</span>
          </div>
          <CardTitle className="text-3xl text-center font-bold">
            {isLogin ? `${selectedRole?.charAt(0).toUpperCase()}${selectedRole?.slice(1)} Login` : "Join BMS Pro"}
          </CardTitle>
          <CardDescription className="text-center text-base">
            {isLogin
              ? "Enter your credentials to access your account"
              : "Enter your details to create a new account"}
          </CardDescription>
          {isLogin && selectedRole && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRole(null)}
              className="text-xs hover:scale-105 transition-transform"
            >
              ← Change role
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAuth} className="space-y-5 animate-slide-in">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-semibold">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    disabled={loading}
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm font-semibold">Role</Label>
                  <select
                    id="role"
                    value={selectedRole || "staff"}
                    onChange={(e) => setSelectedRole(e.target.value as "staff" | "supervisor" | "manager")}
                    className="w-full h-12 px-4 border border-input bg-background rounded-md text-base focus:outline-none focus:ring-2 focus:ring-ring"
                    required={!isLogin}
                    disabled={loading}
                  >
                    <option value="staff">👷 Staff Member</option>
                    <option value="supervisor">👔 Supervisor</option>
                    <option value="manager">💼 Manager</option>
                  </select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-12 text-base"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold hover:scale-105 transition-all shadow-lg hover:shadow-xl" 
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setSelectedRole(null);
              }}
              className="text-primary hover:underline font-medium hover:scale-105 transition-transform inline-block"
              disabled={loading}
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;