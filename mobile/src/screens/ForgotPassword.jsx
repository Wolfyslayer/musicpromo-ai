import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Mail } from "lucide-react-native";
import { db } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import AuthLayout, { IconInput } from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await db.auth.resetPasswordRequest(email);
    } catch {
      // Always show success regardless
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  const backToLogin = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/login");
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Reset password"
      subtitle="We'll send you a link to reset it"
      footer={
        <Pressable onPress={backToLogin} hitSlop={8} className="flex-row items-center gap-1">
          <Icon as={ArrowLeft} size={12} className="text-primary" />
          <Text className="text-sm font-500 text-primary">Back to log in</Text>
        </Pressable>
      }
    >
      {sent ? (
        <Text className="text-center text-sm">
          If an account exists with that email, you&apos;ll receive a password reset link shortly.
        </Text>
      ) : (
        <>
          <View className="gap-2">
            <Label>Email address</Label>
            <IconInput
              icon={Mail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={handleSubmit}
              returnKeyType="send"
            />
          </View>
          <Button className="h-12" onPress={handleSubmit} loading={loading} disabled={!email}>
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </>
      )}
    </AuthLayout>
  );
}
