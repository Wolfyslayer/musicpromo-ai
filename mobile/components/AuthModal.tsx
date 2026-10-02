import { useState } from "react";
import { Link } from "expo-router";
import { Modal, Pressable, Text, View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, ErrorText, Field } from "@/components/ui";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";

export function AuthModal() {
  const { loginOpen, closeLogin } = useAuth();
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
      closeLogin();
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
        closeLogin();
      }
    } catch (err) {
      setError(errorMessage(err, "Google sign-in failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={loginOpen} animationType="slide" transparent onRequestClose={closeLogin}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={closeLogin}>
        <Pressable className="rounded-t-3xl bg-card p-5" onPress={() => {}}>
          <Text className="font-heading text-2xl text-foreground">Sign in to save</Text>
          <Text className="mb-4 mt-1 font-sans text-sm text-muted-foreground">Your place on this screen stays open.</Text>
          <View className="gap-3">
            <Button label="Continue with Google" variant="outline" onPress={google} disabled={loading} />
            <ErrorText>{error}</ErrorText>
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <Button label="Log in" onPress={submit} loading={loading} />
            <Link href="/register" onPress={closeLogin} className="text-center font-sans text-sm text-primary">
              Create an account
            </Link>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
