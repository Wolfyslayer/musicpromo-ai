import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock, Mail, UserPlus } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { db } from '@/api/base44Client';
import AuthLayout, { AuthError, AuthField, safeReturnTo, withReturnTo } from '@/components/AuthLayout';
import GoogleIcon from '@/components/GoogleIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { signInWithGoogle } from '@/lib/supabaseAuth';

export default function Register() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnTo(params.returnTo);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const result = await db.auth.register({ email, password });
      if (result?.session) {
        router.replace(returnTo as any);
        return;
      }
      setShowOtp(true);
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    try {
      await db.auth.verifyOtp({ email, otpCode });
      router.replace(returnTo as any);
    } catch (err: any) {
      setError(err?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await db.auth.resendOtp(email);
      toast({ title: 'Code sent', description: 'Check your email for the new code.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code');
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

  if (showOtp) {
    return (
      <AuthLayout icon={Mail} title="Verify your email" subtitle={`We sent a code to ${email}`}>
        <AuthError message={error} />
        <Input
          value={otpCode}
          onChangeText={(v) => setOtpCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="mb-6 h-14 text-center text-2xl tracking-widest"
        />
        <Button className="h-12" onPress={handleVerify} loading={loading} disabled={otpCode.length < 6}>
          {loading ? 'Verifying...' : 'Verify'}
        </Button>
        <View className="mt-4 flex-row items-center justify-center gap-1">
          <Text className="text-sm text-muted-foreground">Didn&apos;t receive the code?</Text>
          <Pressable hitSlop={8} onPress={handleResend}>
            <Text className="text-sm font-medium text-primary">Resend</Text>
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
        <Text className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Text className="text-sm font-medium text-primary" onPress={() => router.replace(withReturnTo('/login', returnTo) as any)}>
            Log in
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
        <AuthField label="Password" icon={Lock}>
          <Input
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            placeholder="••••••••"
            className="h-12 pl-10"
          />
        </AuthField>
        <AuthField label="Confirm Password" icon={Lock}>
          <Input
            ref={confirmRef}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            placeholder="••••••••"
            className="h-12 pl-10"
          />
        </AuthField>
        <Button className="h-12" onPress={handleSubmit} loading={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
      </View>
    </AuthLayout>
  );
}
