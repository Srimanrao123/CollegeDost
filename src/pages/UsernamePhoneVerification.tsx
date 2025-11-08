import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { OTPInput } from "@/components/auth/OTPInput";
import { Loader2 } from "lucide-react";
import { ProfileService } from "@/services/profileService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bvikkwalgbcembzxnpau.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DEFAULT_COUNTRY_CODE = "+91";
const FULL_NAME_STORAGE_KEY = "phone_verification_full_name";

export default function UsernamePhoneVerification() {
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [fullPhoneNumber, setFullPhoneNumber] = useState("");
  const [timer, setTimer] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Load saved full_name from localStorage on mount
  useEffect(() => {
    try {
      const savedFullName = localStorage.getItem(FULL_NAME_STORAGE_KEY);
      if (savedFullName) {
        setFullName(savedFullName);
        // Focus the input after a short delay to ensure it's rendered
        setTimeout(() => {
          fullNameInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error("Error loading saved full name:", error);
    }
  }, []);

  // Auto-fill full_name from Google user metadata (only once on initial load)
  useEffect(() => {
    if (user && !fullName) {
      const savedFullName = localStorage.getItem(FULL_NAME_STORAGE_KEY);
      if (!savedFullName) {
        const nameFromMetadata = (user as any)?.user_metadata?.name || user.email?.split('@')[0] || '';
        if (nameFromMetadata) {
          setFullName(nameFromMetadata);
          // Save to localStorage
          try {
            localStorage.setItem(FULL_NAME_STORAGE_KEY, nameFromMetadata);
          } catch (error) {
            console.error("Error saving full name:", error);
          }
        }
      }
    }
  }, [user, fullName]);

  // Save full_name to localStorage whenever it changes
  useEffect(() => {
    if (fullName) {
      try {
        localStorage.setItem(FULL_NAME_STORAGE_KEY, fullName);
      } catch (error) {
        console.error("Error saving full name:", error);
      }
    }
  }, [fullName]);

  // Timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);


  const handleSendOTP = async () => {
    // Check if user is authenticated (either Supabase user or phone auth)
    const phoneAuthData = localStorage.getItem("phoneAuth");
    if (!user && !phoneAuthData) {
      toast({
        title: "Error",
        description: "Please log in to continue",
        variant: "destructive",
      });
      return;
    }

    // Validate full name
    if (!fullName || fullName.trim().length < 2) {
      toast({
        title: "Full Name Required",
        description: "Please enter your full name (at least 2 characters)",
        variant: "destructive",
      });
      return;
    }

    // Validate phone number
    if (!phoneNumber || phoneNumber.length !== 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
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
      setTimer(30);
      toast({
        title: "OTP Sent",
        description: "Check your phone for the verification code.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setIsLoading(true);
    try {
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
        body: JSON.stringify({ phone: fullPhoneNumber, code: otp }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Invalid OTP");
      }

      // OTP verified - user is now authenticated in Supabase Auth
      // Get the authenticated user (should exist after verify-otp creates/signs them in)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        throw new Error("User not authenticated. Please verify OTP again.");
      }

      // Update profile with full_name and phone number
      // Username will be auto-generated from full_name
      await ProfileService.upsertProfile(authUser.id, {
        full_name: fullName.trim(),
        phone_no: fullPhoneNumber,
      });

      // Clear saved full_name from localStorage
      try {
        localStorage.removeItem(FULL_NAME_STORAGE_KEY);
      } catch (error) {
        console.error("Error clearing saved full name:", error);
      }

      toast({
        title: "Profile setup complete! 🎉",
        description: "Your profile has been successfully set up.",
      });

      // Notify rest of app
      ProfileService.notifyProfileUpdate();

      // Check onboarding status and navigate
      const profile = await ProfileService.getProfile(authUser.id);

      if (profile?.onboarding_completed) {
        navigate("/");
      } else {
        navigate("/onboarding");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to verify OTP",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer > 0 || !fullPhoneNumber) return;

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

  // Check if user is authenticated via Supabase Auth
  const isAuthenticated = user;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Complete Your Profile</CardTitle>
          <CardDescription className="text-center">
            Please provide your full name and phone number to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Full Name Input */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                ref={fullNameInputRef}
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading || showOtpInput}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter your full name (at least 2 characters)
              </p>
            </div>

            {/* Phone Number Input */}
            {!showOtpInput && (
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
                    disabled={isLoading}
                    className="flex-1"
                    maxLength={10}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter a valid 10-digit phone number
                </p>
              </div>
            )}

            {/* OTP Input */}
            {showOtpInput && (
              <OTPInput
                value={otp}
                onChange={setOtp}
                onResend={handleResendOTP}
                timer={timer}
                disabled={isLoading}
                isLoading={isLoading}
              />
            )}

            {/* Submit Button */}
            <Button
              onClick={showOtpInput ? handleVerifyOTP : handleSendOTP}
              disabled={
                isLoading ||
                !fullName ||
                fullName.trim().length < 2 ||
                (!showOtpInput && phoneNumber.length !== 10) ||
                (showOtpInput && otp.length !== 4)
              }
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {showOtpInput ? "Verifying..." : "Sending..."}
                </>
              ) : showOtpInput ? (
                "Verify Code"
              ) : (
                "Send OTP"
              )}
            </Button>

            {showOtpInput && (
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
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

