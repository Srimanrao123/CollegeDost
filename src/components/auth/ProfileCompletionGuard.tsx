import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ProfileService } from "@/services/profileService";

interface ProfileCompletionGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that ensures phone auth users have completed their profile
 * before accessing protected routes like Home
 */
export function ProfileCompletionGuard({ children }: ProfileCompletionGuardProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    const checkProfileCompletion = async () => {
      try {
        // Check if user is authenticated via phone auth
        const phoneAuthData = typeof window !== 'undefined' ? localStorage.getItem("phoneAuth") : null;
        
        if (!phoneAuthData) {
          // Not a phone auth user, allow access
          setIsChecking(false);
          return;
        }

        // Get user ID
        const userId = await ProfileService.getUserId();
        
        if (!userId) {
          // No user ID, allow access (will be handled by auth guard)
          setIsChecking(false);
          return;
        }

        // Check if profile exists and is completed
        const profile = await ProfileService.getProfile(userId);
        
        if (!profile) {
          // No profile exists, redirect to create profile
          setRedirectTo("/create-profile");
          setIsChecking(false);
          return;
        }

        // Check if onboarding is completed
        if (!profile.onboarding_completed) {
          // Profile exists but onboarding not completed, redirect to onboarding
          setRedirectTo("/onboarding");
          setIsChecking(false);
          return;
        }

        // Profile is completed, allow access
        setIsChecking(false);
      } catch (error) {
        console.error("Error checking profile completion:", error);
        // On error, allow access (fail open)
        setIsChecking(false);
      }
    };

    checkProfileCompletion();
  }, []);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

