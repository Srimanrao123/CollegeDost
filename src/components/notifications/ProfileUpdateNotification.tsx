import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, UserCircle } from "lucide-react";
import { Link } from "react-router-dom";

const DISMISSAL_KEY = 'profileUpdateNotificationDismissed';
const NOTIFICATION_DELAY_DAYS = 1; // Show after 1 day
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const ProfileUpdateNotification = () => {
  const { user } = useAuth();
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (!user) {
      setShowNotification(false);
      return;
    }

    // Check if already dismissed
    const isDismissed = localStorage.getItem(DISMISSAL_KEY) === 'true';
    if (isDismissed) {
      setShowNotification(false);
      return;
    }

    const checkProfile = async () => {
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('full_name, avatar_r2_key, avatar_url, bio, state, entrance_exam, onboarding_completed, created_at')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) {
        setShowNotification(false);
        return;
      }

      // Check if enough time has passed (1 day since account creation)
      const accountCreatedAt = new Date(profile.created_at || user.created_at || Date.now()).getTime();
      const timeElapsed = Date.now() - accountCreatedAt;
      const requiredTime = NOTIFICATION_DELAY_DAYS * ONE_DAY_MS;

      if (timeElapsed < requiredTime) {
        setShowNotification(false);
        return;
      }

      // Check if profile is complete (all fields filled)
      const isComplete = 
        profile.full_name && profile.full_name.trim() !== '' &&
        profile.avatar_url && profile.avatar_url.trim() !== '' &&
        profile.bio && profile.bio.trim() !== '' &&
        profile.state && profile.state.trim() !== '' &&
        profile.entrance_exam && Array.isArray(profile.entrance_exam) && profile.entrance_exam.length > 0;

      // Show notification if profile is not complete and enough time has passed
      setShowNotification(!isComplete);

      // If profile is complete, update onboarding_completed flag
      if (isComplete && !profile.onboarding_completed) {
        await (supabase as any)
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', user.id);
      }
    };

    checkProfile();
  }, [user]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSAL_KEY, 'true');
    setShowNotification(false);
  };

  if (!user || !showNotification) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Alert className="bg-card border-primary/20 shadow-lg">
        <UserCircle className="h-4 w-4 text-primary" />
        <AlertDescription className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="font-semibold mb-1">Complete Your Profile</p>
            <p className="text-sm text-muted-foreground mb-2">
              Complete your profile by adding your bio, profile picture, state, and entrance exam info!
            </p>
            <Button 
              asChild 
              size="sm" 
              className="mr-2"
            >
              <Link 
                to="/profile"
                onClick={() => {
                  // Trigger edit modal after navigation
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('openEditProfile'));
                  }, 100);
                }}
              >
                Update Profile
              </Link>
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDismiss}
            >
              Dismiss
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
};
