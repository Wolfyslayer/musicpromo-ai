import { useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { Lock, LogIn, Mail } from "lucide-react-native";
import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import AuthLayout, { FormError, IconInput, OrDivider } from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

export default function Login() {
  const { finishLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await db.auth.loginViaEmailPassword(email, password);
      await finishLogin();
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
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

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <>
          <Text className="text-sm text-muted-foreground">Don&apos;t have an account? </Text>
          <Link href="/register" replace className="text-sm font-500 text-primary">
            Create one
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
        <View className="flex-row items-center justify-between">
          <Label>Password</Label>
          <Link href="/forgot-password" className="text-xs text-primary">
            Forgot password?
          </Link>
        </View>
        <IconInput
          icon={Lock}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />
      </View>
      <Button className="h-12" onPress={handleSubmit} loading={loading} disabled={!email || !password}>
        {loading ? "Logging in..." : "Log in"}
      </Button>
    </AuthLayout>
  );
}
