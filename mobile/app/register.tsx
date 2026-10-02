import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { UserPlus } from 'lucide-react-native';
import { db } from '@/api/db';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/lib/toast';

export default function RegisterScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const result = await db.auth.register({ email, password });
      if (result?.session) {
        router.replace('/');
        return;
      }
      setShowOtp(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      await db.auth.verifyOtp({ email, otpCode: otp });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await db.auth.resendOtp(email);
      toast({ title: 'Code sent', description: 'Check your email.' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resend');
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    try {
      await db.auth.loginWithProvider('google', '/');
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  if (showOtp) {
    return (
      <AuthLayout icon={UserPlus} title="Verify email" subtitle="Enter the 6-digit code we sent you">
        <View className="gap-4">
          <Input label="Verification code" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={8} />
          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
          <Button label={loading ? 'Verifying…' : 'Verify'} onPress={verifyOtp} disabled={loading} />
          <Button variant="outline" label="Resend code" onPress={resend} />
        </View>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create account"
      subtitle="Start promoting your music with AI"
      footer={
        <View className="flex-row flex-wrap justify-center gap-1">
          <Text className="text-sm text-muted-foreground">Already have an account?</Text>
          <Link href="/login">
            <Text className="text-sm font-medium text-primary">Sign in</Text>
          </Link>
        </View>
      }
    >
      <View className="gap-4">
        <Button variant="outline" label="Continue with Google" onPress={onGoogle} disabled={loading} />
        <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Input label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Input label="Confirm password" secureTextEntry value={confirm} onChangeText={setConfirm} />
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        <Button label={loading ? 'Creating…' : 'Create account'} onPress={onSubmit} disabled={loading} />
        {loading ? <ActivityIndicator /> : null}
      </View>
    </AuthLayout>
  );
}
