import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { resendSignupOtp, signInWithGoogle, verifyEmailOtp } from "@/lib/supabaseAuth";
import { cn } from "@/lib/utils";

export function AuthSuccessPulse() {
  const { authPulse } = useAuth();
  if (!authPulse) return null;
  return <div className="auth-success-pulse pointer-events-none fixed inset-0 z-[60]" aria-hidden="true" />;
}

export default function AuthModal() {
  const { isLoginModalOpen, onLoginModalOpenChange, finishLogin, signInWithPassword, signUp } = useAuth();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const resetFeedback = () => setError("");

  const handleOpenChange = (open) => {
    if (!open && loading) return;
    if (!open) {
      setShowOtp(false);
      setOtpCode("");
      setError("");
    }
    onLoginModalOpenChange(open);
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithGoogle(`${window.location.pathname}${window.location.search}`);
    } catch (err) {
      setError(err?.message || "Google sign-in failed");
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithPassword(email, password);
      await finishLogin();
    } catch (err) {
      setError(err?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp(email, password);
      if (result?.session) await finishLogin();
      else setShowOtp(true);
    } catch (err) {
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      await verifyEmailOtp(email, otpCode);
      await finishLogin();
      setShowOtp(false);
      setOtpCode("");
    } catch (err) {
      setError(err?.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await resendSignupOtp(email);
      toast({ title: "Code sent", description: "Check your email for the new code." });
    } catch (err) {
      setError(err?.message || "Failed to resend code");
    }
  };

  return (
    <Dialog open={isLoginModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(92dvh,760px)] w-[calc(100%-1.25rem)] max-w-md overflow-y-auto rounded-3xl border-border bg-card p-5 text-card-foreground sm:p-6">
        <DialogHeader className="space-y-1 pr-10 text-left">
          <DialogTitle className="font-heading text-xl font-700 tracking-tight">
            {showOtp ? "Verify your email" : "Continue"}
          </DialogTitle>
          <DialogDescription>
            {showOtp
              ? `We sent a code to ${email}`
              : "Browse freely. Sign in when you want to upload, export, or connect."}
          </DialogDescription>
        </DialogHeader>

        {showOtp ? (
          <div className="space-y-4">
            {error ? (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            ) : null}
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button className="h-12 w-full rounded-xl font-600" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Didn&apos;t receive the code?{" "}
              <button type="button" onClick={handleResend} className="min-h-11 font-600 text-primary hover:underline">
                Resend
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
              <button
                type="button"
                className={cn(
                  "min-h-11 rounded-xl text-sm font-600 transition",
                  tab === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => {
                  setTab("login");
                  resetFeedback();
                }}
              >
                Log in
              </button>
              <button
                type="button"
                className={cn(
                  "min-h-11 rounded-xl text-sm font-600 transition",
                  tab === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => {
                  setTab("register");
                  resetFeedback();
                }}
              >
                Create account
              </button>
            </div>

            <Button type="button" variant="outline" className="h-12 w-full rounded-xl text-sm font-600" onClick={handleGoogle}>
              <GoogleIcon className="mr-2 h-5 w-5" />
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">or</span>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            ) : null}

            {tab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="Email" id="auth-email" icon={Mail}>
                  <Input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 rounded-xl pl-10"
                    required
                  />
                </Field>
                <Field
                  label="Password"
                  id="auth-password"
                  icon={Lock}
                  extra={
                    <Link to="/forgot-password" className="text-xs font-600 text-primary hover:underline" onClick={() => handleOpenChange(false)}>
                      Forgot password?
                    </Link>
                  }
                >
                  <Input
                    id="auth-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 rounded-xl pl-10"
                    required
                  />
                </Field>
                <Button type="submit" className="h-12 w-full rounded-xl font-600" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Log in
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <Field label="Email" id="auth-register-email" icon={Mail}>
                  <Input
                    id="auth-register-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 rounded-xl pl-10"
                    required
                  />
                </Field>
                <Field label="Password" id="auth-register-password" icon={Lock}>
                  <Input
                    id="auth-register-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 rounded-xl pl-10"
                    required
                  />
                </Field>
                <Field label="Confirm password" id="auth-register-confirm" icon={Lock}>
                  <Input
                    id="auth-register-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-12 rounded-xl pl-10"
                    required
                  />
                </Field>
                <Button type="submit" className="h-12 w-full rounded-xl font-600" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create account
                </Button>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, icon: Icon, extra, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {extra}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
