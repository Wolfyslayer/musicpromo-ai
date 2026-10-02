import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock, LogIn, Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { db } from '@/api/base44Client';
import AuthLayout, { AuthError, AuthField, safeReturnTo, withReturnTo } from '@/components/AuthLayout';
import GoogleIcon from '@/components/GoogleIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { signInWithGoogle } from '@/lib/supabaseAuth';

export default function Login() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnTo(params.returnTo);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password');
      return;
    }
    setLoading(true);
    try {
      await db.auth.loginViaEmailPassword(email, password);
      router.replace(returnTo as any);
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const session = await signInWithGoogle();
      if (session) router.replace(returnTo as any);
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <Text className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Text className="text-sm font-medium text-primary" onPress={() => router.replace(withReturnTo('/register', returnTo) as any)}>
            Create one
          </Text>
        </Text>
      }>
      <Button variant="outline" className="mb-6 h-12" onPress={handleGoogle} disabled={loading}>
        <GoogleIcon size={20} />
        <Text className="text-sm font-medium">Continue with Google</Text>
      </Button>

      <View className="mb-6 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs uppercase text-muted-foreground">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <AuthError message={error} />

      <View className="gap-4">
        <AuthField label="Email" icon={Mail}>
          <Input
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="you@example.com"
            className="h-12 pl-10"
          />
        </AuthField>
        <AuthField
          label="Password"
          icon={Lock}
          extra={
            <Pressable hitSlop={8} onPress={() => router.push('/forgot-password')}>
              <Text className="text-xs text-primary">Forgot password?</Text>
            </Pressable>
          }>
          <Input
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            placeholder="••••••••"
            className="h-12 pl-10"
          />
        </AuthField>
        <Button className="h-12" onPress={handleSubmit} loading={loading}>
          {loading ? 'Logging in...' : 'Log in'}
        </Button>
      </View>
    </AuthLayout>
  );
}
