import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Lock, Mail, UserPlus } from "lucide-react-native";
import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import AuthLayout, { FormError, IconInput, OrDivider } from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

const OTP_LENGTH = 6;

export default function Register() {
  const { finishLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const result = await db.auth.register({ email, password });
      if (result?.session) {
        await finishLogin();
        return;
      }
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      await db.auth.verifyOtp({ email, otpCode });
      await finishLogin();
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await db.auth.resendOtp(email);
      toast({
        title: "Code sent",
        description: "Check your email for the new code.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const session = await db.auth.loginWithProvider("google");
      if (session) await finishLogin();
    } catch (err) {
      setError(err.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  if (showOtp) {
    return (
      <AuthLayout icon={Mail} title="Verify your email" subtitle={`We sent a code to ${email}`}>
        <FormError message={error} />
        <Input
          value={otpCode}
          onChangeText={(v) => setOtpCode(v.replace(/\D/g, "").slice(0, OTP_LENGTH))}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          autoFocus
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          placeholder="••••••"
          className="h-14 text-center text-2xl font-600 tracking-[8px]"
          onSubmitEditing={() => otpCode.length >= OTP_LENGTH && handleVerify()}
        />
        <Button className="h-12" onPress={handleVerify} loading={loading} disabled={otpCode.length < OTP_LENGTH}>
          {loading ? "Verifying..." : "Verify"}
        </Button>
        <View className="flex-row flex-wrap items-center justify-center">
          <Text className="text-sm text-muted-foreground">Didn&apos;t receive the code? </Text>
          <Pressable onPress={handleResend} hitSlop={8}>
            <Text className="text-sm font-500 text-primary">Resend</Text>
          </Pressable>
        </View>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          <Text className="text-sm text-muted-foreground">Already have an account? </Text>
          <Link href="/login" replace className="text-sm font-500 text-primary">
            Log in
          </Link>
        </>
      }
    >
      <Button variant="outline" className="h-12" onPress={handleGoogle} loading={googleLoading}>
        {!googleLoading ? <GoogleIcon size={20} /> : null}
        Continue with Google
      </Button>

      <OrDivider />
      <FormError message={error} />

      <View className="gap-2">
        <Label>Email</Label>
        <IconInput
          icon={Mail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
        />
      </View>
      <View className="gap-2">
        <Label>Password</Label>
        <IconInput
          icon={Lock}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
        />
      </View>
      <View className="gap-2">
        <Label>Confirm Password</Label>
        <IconInput
          icon={Lock}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />
      </View>
      <Button
        className="h-12"
        onPress={handleSubmit}
        loading={loading}
        disabled={!email || !password || !confirmPassword}
      >
        {loading ? "Creating account..." : "Create account"}
      </Button>
    </AuthLayout>
  );
}
