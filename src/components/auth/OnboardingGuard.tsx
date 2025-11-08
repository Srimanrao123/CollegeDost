import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ProfileService } from "@/services/profileService";
import { useAuth } from "@/hooks/useAuth";

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that ensures:
 * 1. Google users have verified their phone before accessing onboarding
 * 2. Phone auth users have completed their profile before accessing onboarding
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const checkRequirements = async () => {
      try {
        // Check if user is authenticated via phone auth
        const phoneAuthData = typeof window !== 'undefined' ? localStorage.getItem("phoneAuth") : null;
        
        // Get user ID
        const userId = await ProfileService.getUserId();
        
        if (!userId) {
          // No user ID, redirect to auth
          setRedirectTo("/auth");
          setIsChecking(false);
          return;
        }

        // Check if profile exists
        const profile = await ProfileService.getProfile(userId);
        
        if (!profile) {
          // No profile exists
          // Check if it's a Google user or phone auth user
          const isGoogleUser = user?.app_metadata?.provider === 'google' || 
            (user?.email && !user?.phone);
          
          if (isGoogleUser) {
            // Google user without profile should verify phone first
            setRedirectTo("/verify-phone");
          } else {
            // Phone auth user should create profile first
            setRedirectTo("/create-profile");
          }
          setIsChecking(false);
          return;
        }

        // Profile exists - check specific requirements
        // Determine if user is Google user or phone auth user
        const isGoogleUser = user && (user.app_metadata?.provider === 'google' || 
          (user.email && !user.phone));
        
        if (isGoogleUser) {
          // Google users must have phone_no verified before onboarding
          if (!profile.phone_no) {
            setRedirectTo("/verify-phone");
            setIsChecking(false);
            return;
          }
        } else {
          // Phone auth users must have full_name (profile completed) before onboarding
          if (!profile.full_name) {
            setRedirectTo("/create-profile");
            setIsChecking(false);
            return;
          }
        }

        // All requirements met, allow access to onboarding
        setIsChecking(false);
      } catch (error) {
        console.error("Error checking onboarding requirements:", error);
        // On error, allow access (fail open)
        setIsChecking(false);
      }
    };

    checkRequirements();
  }, [user]);

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

