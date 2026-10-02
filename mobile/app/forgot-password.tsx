import { useState } from "react";
import { Link } from "expo-router";
import { View } from "react-native";
import { AuthScreen } from "@/components/AuthScreen";
import { Button, Field, Muted } from "@/components/ui";
import { db } from "@/lib/db";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await db.auth.resetPasswordRequest(email);
    } catch {
      /* Always show success so addresses cannot be enumerated. */
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthScreen
      title="Reset password"
      subtitle="We'll send you a link to reset it"
      footer={
        <Link href="/login" className="font-sans text-sm text-primary">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <Muted>If an account exists for that email, a reset link is on its way. Open it on this device.</Muted>
      ) : (
        <View className="gap-4">
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Button label="Send reset link" onPress={submit} loading={loading} />
        </View>
      )}
    </AuthScreen>
  );
}
