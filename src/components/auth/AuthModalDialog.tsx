import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Chrome } from "lucide-react";

interface AuthModalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModalDialog({ open, onOpenChange }: AuthModalDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        }
      });
      
      if (error) throw error;
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handlePhoneAuth = async () => {
    setIsLoading(true);
    try {
      if (!showOtpInput) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: phoneNumber,
        });
        
        if (error) throw error;
        
        setShowOtpInput(true);
        toast({
          title: "OTP Sent",
          description: "Check your phone for the verification code.",
        });
      } else {
        const { error } = await supabase.auth.verifyOtp({
          phone: phoneNumber,
          token: otp,
          type: 'sms',
        });
        
        if (error) throw error;
        
        toast({
          title: "Success!",
          description: "You've successfully logged in.",
        });
        onOpenChange(false);
        navigate("/");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Welcome</DialogTitle>
          <DialogDescription className="text-center">
            Sign in to continue
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={isLoading || showOtpInput}
            />
          </div>
          
          {showOtpInput && (
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={isLoading}
                maxLength={6}
              />
            </div>
          )}

          <Button
            onClick={handlePhoneAuth}
            disabled={isLoading || !phoneNumber || (showOtpInput && !otp)}
            className="w-full"
          >
            {showOtpInput ? "Verify Code" : "Send Code"}
          </Button>

          {showOtpInput && (
            <Button
              onClick={() => {
                setShowOtpInput(false);
                setOtp("");
              }}
              variant="ghost"
              className="w-full"
            >
              Use Different Number
            </Button>
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
      </DialogContent>
    </Dialog>
  );
}
