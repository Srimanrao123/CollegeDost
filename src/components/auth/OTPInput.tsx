import { useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  onResend?: () => void;
  timer?: number;
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
  helperText?: string;
}

export function OTPInput({
  value,
  onChange,
  onResend,
  timer = 0,
  disabled = false,
  isLoading = false,
  label = "Verification Code",
  helperText = "Enter the 4-digit code sent to your phone",
}: OTPInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="otp">{label}</Label>
      <div className="flex justify-center">
        <InputOTP
          value={value}
          onChange={onChange}
          maxLength={4}
          disabled={disabled || isLoading}
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
        {helperText}
      </p>
      {onResend && (
        <div className="space-y-2">
          {timer > 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Resend code in {timer}s
            </p>
          ) : (
            <Button
              onClick={onResend}
              variant="outline"
              className="w-full"
              disabled={isLoading}
            >
              Resend OTP
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

