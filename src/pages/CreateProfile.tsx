import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { ProfileService } from "@/services/profileService";

export default function CreateProfile() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get phone number from user
  useEffect(() => {
    const getPhoneNumber = async () => {
      if (user?.phone) {
        // Phone number is available from auth user
        return;
      }
    };
    getPhoneNumber();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || fullName.trim().length < 2) {
      toast({
        title: "Full Name Required",
        description: "Please enter your full name (at least 2 characters)",
        variant: "destructive",
      });
      return;
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const userId = await ProfileService.getUserId();
      
      if (!userId) {
        toast({
          title: "Authentication Required",
          description: "Please log in to continue",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Get phone number from user (Supabase auth) or phone auth (localStorage)
      let phoneNumber = user?.phone || await ProfileService.getPhoneNumber();
      
      // If no phone from Supabase auth, check phone auth localStorage
      if (!phoneNumber) {
        const userPhone = typeof window !== 'undefined' ? localStorage.getItem("userPhone") : null;
        if (userPhone) {
          phoneNumber = userPhone.startsWith('+') ? userPhone : `+91${userPhone}`;
        }
      }
      
      if (!phoneNumber) {
        toast({
          title: "Phone Number Missing",
          description: "Phone number is required. Please log in again.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Create profile with full_name, email, and phone_no
      // Username will be auto-generated
      await ProfileService.upsertProfile(userId, {
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        phone_no: phoneNumber,
      });

      toast({
        title: "Profile Created! 🎉",
        description: "Your profile has been successfully created.",
      });

      // Notify rest of app
      ProfileService.notifyProfileUpdate();

      // Redirect to onboarding
      navigate("/onboarding");
    } catch (error: any) {
      console.error("Error creating profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user is authenticated (Supabase auth or phone auth)
  const phoneAuthData = typeof window !== 'undefined' ? localStorage.getItem("phoneAuth") : null;
  const isAuthenticated = user || phoneAuthData;
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Get phone number for display
  const displayPhone = user?.phone || (typeof window !== 'undefined' ? localStorage.getItem("userPhone") : null) || "Not available";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Create Your Profile</CardTitle>
          <CardDescription className="text-center">
            Please provide your information to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading}
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">
                Enter your full name (at least 2 characters)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Your email address (optional)
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Phone: {displayPhone}
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !fullName.trim() || fullName.trim().length < 2}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Profile...
                </>
              ) : (
                "Create Profile"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

