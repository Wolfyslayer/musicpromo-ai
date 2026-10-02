import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { AuthScreen } from "@/components/AuthScreen";
import { Button, ErrorText, Field } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";

export default function Register() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const result = await db.auth.register({ email, password });
      if (result?.session) {
        router.replace("/");
        return;
      }
      setShowOtp(true);
    } catch (err) {
      setError(errorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setError("");
    setLoading(true);
    try {
      await db.auth.verifyOtp({ email, otpCode: otp });
      toast({ title: "Email confirmed" });
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err, "Invalid verification code"));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await db.auth.resendOtp(email);
      toast({ title: "Code sent", description: "Check your email for the new code." });
    } catch (err) {
      setError(errorMessage(err, "Failed to resend code"));
    }
  };

  return (
    <AuthScreen
      title={showOtp ? "Check your email" : "Create account"}
      subtitle={showOtp ? `Enter the code sent to ${email}` : "Start planning your next release"}
      footer={
        <Link href="/login" className="font-sans text-sm text-primary">
          Back to log in
        </Link>
      }
    >
      <View className="gap-4">
        <ErrorText>{error}</ErrorText>
        {showOtp ? (
          <>
            <Field label="Verification code" value={otp} onChangeText={setOtp} placeholder="123456" keyboardType="number-pad" />
            <Button label="Confirm email" onPress={verify} loading={loading} />
            <Button label="Resend code" variant="ghost" onPress={resend} />
          </>
        ) : (
          <>
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry />
            <Button label="Create account" onPress={submit} loading={loading} />
            <Text className="font-sans text-xs text-muted-foreground">
              By creating an account you agree to the Terms and Privacy Policy.
            </Text>
          </>
        )}
      </View>
    </AuthScreen>
  );
}
