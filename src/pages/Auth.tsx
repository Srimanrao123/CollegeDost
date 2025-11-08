import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Chrome, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ProfileService } from "@/services/profileService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bvikkwalgbcembzxnpau.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DEFAULT_COUNTRY_CODE = "+91";

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [fullPhoneNumber, setFullPhoneNumber] = useState("");
  const [timer, setTimer] = useState(0);
  const [needsPhoneInfo, setNeedsPhoneInfo] = useState(false);
  const [name, setName] = useState("");
  const [phoneForGoogle, setPhoneForGoogle] = useState("");
  const [needsUsername, setNeedsUsername] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [hasUserEditedUsername, setHasUserEditedUsername] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check if user just logged in via Google and needs to provide phone and name
  useEffect(() => {
    const checkGoogleUserNeedsInfo = async () => {
      if (!user) {
        setNeedsPhoneInfo(false);
        return;
      }

      // Check if user logged in via Google (has email but might not have phone)
      const isGoogleUser = user.app_metadata?.provider === 'google' || 
                          (user.email && !user.phone);
      
      if (isGoogleUser) {
        // Check if profile has phone_no in profiles table
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('phone_no')
          .eq('id', user.id)
          .maybeSingle();
        
        if (!profile?.phone_no) {
          setNeedsPhoneInfo(true);
          // Pre-fill name from user metadata if available
          const userName = (user as any)?.user_metadata?.name || user.email?.split('@')[0] || '';
          setName(userName);
        }
      }
    };

    checkGoogleUserNeedsInfo();
  }, [user]);

  // Timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Cleanup validation timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  // Focus username input when form appears
  useEffect(() => {
    if (needsUsername && usernameInputRef.current) {
      setTimeout(() => {
        usernameInputRef.current?.focus();
      }, 100);
    }
  }, [needsUsername]);

  // Validate username (debounced to prevent focus loss)
  const validateUsername = useCallback(async (value: string): Promise<boolean> => {
    if (!value || value.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return false;
    }
    if (value.length > 20) {
      setUsernameError("Username must be 20 characters or less");
      return false;
    }
    if (!/^[a-z0-9_]+$/.test(value)) {
      setUsernameError("Username can only contain lowercase letters, numbers, and underscores");
      return false;
    }

    // Check uniqueness
    setIsCheckingUsername(true);
    try {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('id')
        .eq('username', value)
        .maybeSingle();

      if (data) {
        setUsernameError("Username is already taken");
        setIsCheckingUsername(false);
        return false;
      }
      setUsernameError("");
      setIsCheckingUsername(false);
      return true;
    } catch (error) {
      setUsernameError("Error checking username availability");
      setIsCheckingUsername(false);
      return false;
    }
  }, []);

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    
    // Mark that user has manually edited the username
    setHasUserEditedUsername(true);
    
    // Update state immediately to maintain focus
    setUsername(normalized);
    
    // Clear previous timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    // If user cleared the field, clear errors
    if (normalized.length === 0) {
      setUsernameError("");
      setIsCheckingUsername(false);
      return;
    }

    // Clear error if too short
    if (normalized.length < 3) {
      setUsernameError("");
      setIsCheckingUsername(false);
      return;
    }

    // Debounce validation to prevent focus loss
    validationTimeoutRef.current = setTimeout(async () => {
      await validateUsername(normalized);
    }, 1000);
  }, [validateUsername]);

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`,
        }
      });
      
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleSaveGoogleUserInfo = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Validate inputs
      if (!name.trim()) {
        toast({
          title: "Name Required",
          description: "Please enter your name",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!phoneForGoogle || phoneForGoogle.length < 10) {
        toast({
          title: "Phone Number Required",
          description: "Please enter a valid 10-digit phone number",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const fullPhone = `${DEFAULT_COUNTRY_CODE}${phoneForGoogle}`;

      // Update profile with phone_no and username
      const username = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
      const { data: existingProfile } = await (supabase as any)
        .from('profiles')
        .select('id, username')
        .eq('id', user.id)
        .maybeSingle();

      if (existingProfile) {
        // Update profile with phone_no
        const { error: profileError } = await (supabase as any)
          .from('profiles')
          .update({
            phone_no: fullPhone,
            username: username,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (profileError) throw profileError;
      } else {
        // Create profile if it doesn't exist
        const { error: insertError } = await (supabase as any)
          .from('profiles')
          .insert({
            id: user.id,
            username: username,
            phone_no: fullPhone,
            avatar_url: (user as any)?.user_metadata?.picture || null,
            followers_count: 0,
            following_count: 0,
            onboarding_completed: false,
          });

        if (insertError) throw insertError;
      }

      toast({
        title: "Success!",
        description: "Your information has been saved.",
      });

      setNeedsPhoneInfo(false);
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneAuth = async () => {
    setIsLoading(true);
    try {
      if (!showOtpInput) {
        // Validate phone number
        if (!phoneNumber || phoneNumber.length < 10) {
          toast({
            title: "Invalid Phone Number",
            description: "Please enter a valid phone number",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Combine country code and phone number
        const fullNumber = `${DEFAULT_COUNTRY_CODE}${phoneNumber}`;
        setFullPhoneNumber(fullNumber);

        // Send OTP using Supabase Edge Function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone: fullNumber }),
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to send OTP");
        }
        
        setShowOtpInput(true);
        setTimer(30); // 30 second timer
        toast({
          title: "OTP Sent",
          description: "Check your phone for the verification code.",
        });
      } else {
        // Validate OTP
        if (!otp || otp.length !== 4) {
          toast({
            title: "Invalid OTP",
            description: "Please enter the 4-digit OTP",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Verify OTP using Supabase Edge Function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ 
            phone: fullPhoneNumber, 
            code: otp
          }),
        });

        const data = await response.json();
        
        console.log("📥 Verify OTP Response:", {
          success: data.success,
          hasUser: !!data.user,
          userId: data.user?.id,
          hasSession: !!data.session,
          hasAccessToken: !!data.session?.access_token,
          userExists: data.userExists,
          requiresClientSignIn: data.requiresClientSignIn,
        });
        
        if (!response.ok || !data.success) {
          console.error("❌ OTP verification failed:", data.error);
          throw new Error(data.error || "Invalid OTP");
        }

        // OTP verified successfully
        const { user: responseUser, session: authSession, userExists } = data;
        
        console.log("✅ OTP verified successfully");
        console.log("User exists:", userExists);
        console.log("Response user ID:", responseUser?.id);
        console.log("Has session token:", !!authSession?.access_token);
        
        // Set Supabase session if provided
        if (authSession?.access_token) {
          console.log("🔐 Setting Supabase session...");
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: authSession.access_token,
            refresh_token: authSession.refresh_token || "",
          });

          if (sessionError) {
            console.error("❌ Failed to set session:", sessionError);
            console.error("Session error details:", {
              message: sessionError.message,
              status: sessionError.status,
            });
            throw new Error(`Failed to set session: ${sessionError.message}`);
          }

          console.log("✅ Session set successfully");
          // Wait a bit for session to be set
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.warn("⚠️ No session token received from verify-otp");
        }

        // Get the authenticated user from Supabase auth
        console.log("👤 Fetching authenticated user...");
        const { data: { user: authUser }, error: getUserError } = await supabase.auth.getUser();
        
        console.log("Get user result:", {
          hasUser: !!authUser,
          userId: authUser?.id,
          hasError: !!getUserError,
          errorMessage: getUserError?.message,
        });
        
        if (getUserError || !authUser) {
          console.error("❌ Failed to get authenticated user");
          console.error("Get user error:", getUserError);
          
          // If we have response user ID, use it as fallback
          if (responseUser?.id) {
            console.warn("⚠️ Using fallback: navigating based on response user and userExists flag");
            console.log("Fallback navigation - userExists:", userExists);
            
            // Try to navigate based on userExists flag
            if (userExists) {
              console.log("➡️ Redirecting existing user to home");
              toast({
                title: "Welcome back!",
                description: "You've successfully logged in.",
              });
              navigate("/");
            } else {
              console.log("➡️ Redirecting new user to create profile");
              toast({
                title: "OTP Verified!",
                description: "Please complete your profile to continue.",
              });
              navigate("/create-profile");
            }
            return;
          }
          
          console.error("❌ No fallback available - no user information");
          throw new Error("Failed to get user information. Please try logging in again.");
        }

        console.log("✅ Successfully got authenticated user:", authUser.id);

        // Check if user exists (from response)
        if (userExists) {
          console.log("👤 Existing user flow");
          // Existing user - get profile and redirect to home
          const profile = await ProfileService.getProfile(authUser.id);
          console.log("Profile fetched:", !!profile);
          
          ProfileService.notifyProfileUpdate();
          
          toast({
            title: "Welcome back!",
            description: "You've successfully logged in.",
          });

          console.log("➡️ Redirecting to home");
          navigate("/");
        } else {
          console.log("🆕 New user flow");
          // New user - redirect to create profile
          ProfileService.notifyProfileUpdate();
          
          toast({
            title: "OTP Verified!",
            description: "Please complete your profile to continue.",
          });

          console.log("➡️ Redirecting to create profile");
          navigate("/create-profile");
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred with phone authentication",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone: fullPhoneNumber }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setTimer(30);
        setOtp("");
        toast({
          title: "OTP Resent",
          description: "New code sent to your phone.",
        });
      } else {
        throw new Error(data.error || "Failed to resend OTP");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend OTP",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfileWithUsername = async () => {
    if (!fullPhoneNumber) {
      toast({
        title: "Error",
        description: "Phone number is missing",
        variant: "destructive",
      });
      return;
    }

    // Validate username
    const isValidUsername = await validateUsername(username);
    if (!isValidUsername) {
      return;
    }

    setIsLoading(true);
    try {
      // Get current user from Supabase Auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        throw new Error("User not authenticated. Please verify OTP again.");
      }

      // Update profile with username
      await ProfileService.upsertProfile(authUser.id, {
        username,
        phone_no: fullPhoneNumber,
      });

      toast({
        title: "Profile Created! 🎉",
        description: "Your profile has been successfully created.",
      });

      // Notify rest of app
      ProfileService.notifyProfileUpdate();

      // Check onboarding status
      const profile = await ProfileService.getProfile(authUser.id);
      
      if (profile?.onboarding_completed) {
        navigate("/");
      } else {
        navigate("/onboarding");
      }
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

  // Show username collection form for first-time phone users
  if (needsUsername) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/10">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Create Your Profile</CardTitle>
            <CardDescription className="text-center">
              Choose a unique username to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <Input
                    ref={usernameInputRef}
                    id="username"
                    type="text"
                    placeholder="username_123"
                    value={username}
                    onChange={handleUsernameChange}
                    disabled={isLoading}
                    className={usernameError ? "border-destructive" : ""}
                  />
                  {isCheckingUsername && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {usernameError && (
                  <p className="text-sm text-destructive">{usernameError}</p>
                )}
                {!usernameError && username && username.length >= 3 && (
                  <p className="text-sm text-green-600">✓ Username available</p>
                )}
                <p className="text-xs text-muted-foreground">
                  3-20 characters, lowercase letters, numbers, and underscores only
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Phone: {fullPhoneNumber}
                </p>
              </div>

              <Button
                onClick={handleCreateProfileWithUsername}
                disabled={isLoading || !username || username.length < 3 || !!usernameError || isCheckingUsername}
                className="w-full"
              >
                {isLoading ? "Creating Profile..." : "Create Profile"}
              </Button>

              <Button
                onClick={() => {
                  setNeedsUsername(false);
                  setUsername("");
                  setUsernameError("");
                  setShowOtpInput(false);
                  setOtp("");
                  setPhoneNumber("");
                  setFullPhoneNumber("");
                }}
                variant="ghost"
                className="w-full"
                disabled={isLoading}
              >
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show phone collection form for Google users
  if (needsPhoneInfo && user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/10">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Complete Your Profile</CardTitle>
            <CardDescription className="text-center">
              Please provide your name and phone number to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                    🇮🇳 {DEFAULT_COUNTRY_CODE}
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={phoneForGoogle}
                    onChange={(e) => setPhoneForGoogle(e.target.value.replace(/\D/g, ""))}
                    disabled={isLoading}
                    className="flex-1"
                    maxLength={10}
                  />
                </div>
              </div>

              <Button
                onClick={handleSaveGoogleUserInfo}
                disabled={isLoading || !name.trim() || phoneForGoogle.length < 10}
                className="w-full"
              >
                {isLoading ? "Saving..." : "Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Welcome</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                  🇮🇳 {DEFAULT_COUNTRY_CODE}
                </div>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="9876543210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  disabled={isLoading || showOtpInput}
                  className="flex-1"
                  maxLength={10}
                />
              </div>
            </div>
            
            {showOtpInput && (
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <div className="flex justify-center">
                  <InputOTP
                    value={otp}
                    onChange={(value) => setOtp(value)}
                    maxLength={4}
                    disabled={isLoading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Enter the 4-digit code sent to your phone
                </p>
              </div>
            )}

            <Button
              onClick={handlePhoneAuth}
              disabled={
                isLoading || 
                (!showOtpInput && (!phoneNumber || phoneNumber.length !== 10)) ||
                (showOtpInput && otp.length !== 4)
              }
              className="w-full"
            >
              {isLoading ? "Loading..." : showOtpInput ? "Verify Code" : "Send Code"}
            </Button>

            {showOtpInput && (
              <div className="space-y-2">
                {timer > 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    Resend code in {timer}s
                  </p>
                ) : (
                  <Button
                    onClick={handleResendOtp}
                    variant="outline"
                    className="w-full"
                    disabled={isLoading}
                  >
                    Resend OTP
                  </Button>
                )}
                
                <Button
                  onClick={() => {
                    setShowOtpInput(false);
                    setOtp("");
                    setTimer(0);
                  }}
                  variant="ghost"
                  className="w-full"
                  disabled={isLoading}
                >
                  Use Different Number
                </Button>
              </div>
            )}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            onClick={handleGoogleAuth}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            <Chrome className="mr-2 h-4 w-4" />
            Sign in with Google
          </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
