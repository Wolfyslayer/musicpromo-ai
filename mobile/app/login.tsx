import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { LogIn } from 'lucide-react-native';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { db } from '@/api/db';
import { useAuth } from '@/lib/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const destination = typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : '/';

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace(destination as '/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await db.auth.loginWithProvider('google', destination);
      router.replace(destination as '/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Google sign-in failed';
      if (!/cancel/i.test(msg)) setError(msg);
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
        <View className="flex-row flex-wrap justify-center gap-1">
          <Text className="text-sm text-muted-foreground">Don&apos;t have an account?</Text>
          <Link href="/register">
            <Text className="text-sm font-medium text-primary">Create one</Text>
          </Link>
        </View>
      }
    >
      <Button variant="outline" label="Continue with Google" onPress={onGoogle} className="mb-6" />
      <View className="gap-4">
        <Input
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Password"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        <Link href="/forgot-password" className="text-sm text-primary">
          Forgot password?
        </Link>
        <Button
          label={loading ? 'Signing in…' : 'Sign in'}
          onPress={onSubmit}
          disabled={loading}
        />
        {loading ? <ActivityIndicator className="mt-2" /> : null}
      </View>
    </AuthLayout>
  );
}
