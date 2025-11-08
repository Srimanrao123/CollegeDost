import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { OTPInput } from "@/components/auth/OTPInput";
import { Loader2 } from "lucide-react";
import { ProfileService } from "@/services/profileService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bvikkwalgbcembzxnpau.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DEFAULT_COUNTRY_CODE = "+91";

export default function VerifyPhone() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [fullPhoneNumber, setFullPhoneNumber] = useState("");
  const [timer, setTimer] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOTP = async () => {
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

      // OTP verified - update profile with phone number
      const userId = await ProfileService.getUserId();
      
      if (!userId || !user) {
        throw new Error("User not authenticated");
      }

      // Update profile with phone number and full_name from Google account
      await ProfileService.upsertProfile(userId, {
        full_name: fullName.trim() || (user as any)?.user_metadata?.name || user.email?.split('@')[0] || undefined,
        phone_no: fullPhoneNumber,
      });

      toast({
        title: "Phone Verified! 🎉",
        description: "Your phone number has been successfully verified.",
      });

      // Notify rest of app
      ProfileService.notifyProfileUpdate();

      // Redirect to onboarding
      navigate("/onboarding");
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

  useEffect(() => {
    if (!user) return;

    const defaultName =
      (user as any)?.user_metadata?.name ||
      (user as any)?.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "";

    setFullName((prev) => (prev ? prev : defaultName || ""));
  }, [user]);

  // Check if user is authenticated via Google
  if (!user) {
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
          <CardTitle className="text-2xl font-bold text-center">Verify Your Phone Number</CardTitle>
          <CardDescription className="text-center">
            Please verify your phone number to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Phone Number Input */}
            {!showOtpInput && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    Update your name (optional)
                  </p>
                </div>

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

