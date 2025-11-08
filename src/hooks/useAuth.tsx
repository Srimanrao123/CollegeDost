import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

const AUTH_FLOW_PATHS = new Set([
  "/auth",
  "/onboarding",
  "/create-profile",
  "/verify-phone",
  "/username-phone-verification",
]);

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const locationRef = useRef(location.pathname);
  const handledSessionUserRef = useRef<string | null>(null);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const ensureNavigation = (target: string) => {
      if (locationRef.current !== target) {
        navigate(target, { replace: true });
      }
    };

    const handlePostSignIn = async (currentSession: Session) => {
      try {
        const currentUser = currentSession.user;
        if (!currentUser) return;

        if (handledSessionUserRef.current === currentUser.id) {
          return;
        }

        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('onboarding_completed, phone_no, full_name')
          .eq('id', currentUser.id)
          .maybeSingle();

        const isGoogleUser = currentUser.app_metadata?.provider === 'google' ||
          (currentUser.email && !currentUser.phone);

        const currentPath = locationRef.current;
        const isAuthRoute = AUTH_FLOW_PATHS.has(currentPath);

        if (profile) {
          if (profile.onboarding_completed) {
            if (isAuthRoute) {
              ensureNavigation('/');
            }
          } else {
            // Check if user can access onboarding
            // Google users need phone_no
            // Phone auth users need full_name
            if (isGoogleUser && !profile.phone_no) {
              ensureNavigation('/verify-phone');
            } else if (!isGoogleUser && !profile.full_name) {
              ensureNavigation('/create-profile');
            } else {
              ensureNavigation('/onboarding');
            }
          }
        } else {
          // No profile exists
          const target = isGoogleUser ? '/verify-phone' : '/create-profile';
          ensureNavigation(target);
        }

        handledSessionUserRef.current = currentUser.id;
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        if (AUTH_FLOW_PATHS.has(locationRef.current)) {
          ensureNavigation('/');
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && newSession?.user) {
          setTimeout(() => {
            handlePostSignIn(newSession);
          }, 100);
        }

        if (event === 'SIGNED_OUT') {
          handledSessionUserRef.current = null;
          setUser(null);
          setSession(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    try {
      handledSessionUserRef.current = null;
      setUser(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      localStorage.removeItem("phoneAuth");
      localStorage.removeItem("userPhone");
      
      toast({
        title: "Signed out",
        description: "You've been successfully signed out.",
      });
      
      navigate('/', { replace: true });
    } catch (error: any) {
      handledSessionUserRef.current = null;
      setUser(null);
      setSession(null);
      
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
      
      navigate('/', { replace: true });
    }
  };

  const phoneAuthData = typeof window !== 'undefined' ? localStorage.getItem("phoneAuth") : null;
  const isPhoneAuthenticated = phoneAuthData ? (() => {
    try {
      const phoneAuth = JSON.parse(phoneAuthData);
      return phoneAuth.verified === true;
    } catch {
      return false;
    }
  })() : false;

  return {
    user,
    session,
    loading,
    signOut,
    isAuthenticated: !!user || isPhoneAuthenticated,
  };
}
