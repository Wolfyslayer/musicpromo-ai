import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { AuthScreen } from "@/components/AuthScreen";
import { Button, ErrorText, Field } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";

export default function Login() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await db.auth.loginViaEmailPassword(email, password);
      toast({ title: "You're signed in" });
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setError("");
    setLoading(true);
    try {
      const session = await db.auth.loginWithGoogle();
      if (session) {
        toast({ title: "You're signed in" });
        router.replace("/");
      }
    } catch (err) {
      setError(errorMessage(err, "Google sign-in failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <Text className="font-sans text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/register" className="text-primary">
            Create one
          </Link>
        </Text>
      }
    >
      <View className="gap-4">
        <Button label="Continue with Google" variant="outline" onPress={google} disabled={loading} />
        <ErrorText>{error}</ErrorText>
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
        <Link href="/forgot-password" className="font-sans text-xs text-primary">
          Forgot password?
        </Link>
        <Button label="Log in" onPress={submit} loading={loading} />
      </View>
    </AuthScreen>
  );
}
