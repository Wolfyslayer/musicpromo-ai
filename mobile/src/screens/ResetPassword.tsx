import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { AlertTriangle, Lock } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { db } from '@/api/base44Client';
import AuthLayout, { AuthError, AuthField } from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { createSessionFromUrl, signOut } from '@/lib/supabaseAuth';

type LinkState = 'checking' | 'ready' | 'invalid';

const LINK_PARAM = /[#?&](access_token|code|error|error_description)=/;
const LINK_WAIT_MS = 3000;

export default function ResetPassword() {
  const router = useRouter();
  const url = Linking.useURL();
  const processedUrl = useRef<string | null>(null);
  const confirmRef = useRef<TextInput>(null);
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [linkError, setLinkError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url || !LINK_PARAM.test(url) || processedUrl.current === url) return;
    processedUrl.current = url;
    let cancelled = false;
    (async () => {
      try {
        const session = await createSessionFromUrl(url);
        if (cancelled) return;
        if (session) {
          setLinkState('ready');
        } else {
          setLinkError('');
          setLinkState('invalid');
        }
      } catch (err: any) {
        if (cancelled) return;
        setLinkError(err?.message || '');
        setLinkState('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (linkState !== 'checking') return undefined;
    const timer = setTimeout(() => {
      if (!processedUrl.current) setLinkState('invalid');
    }, LINK_WAIT_MS);
    return () => clearTimeout(timer);
  }, [linkState, url]);

  const handleSubmit = async () => {
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await db.auth.resetPassword({ newPassword });
      await signOut().catch(() => {});
      toast({ title: 'Password updated', description: 'Log in with your new password.' });
      router.replace('/login');
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (linkState === 'checking') {
    return (
      <AuthLayout icon={Lock} title="New password" subtitle="Checking your reset link...">
        <View className="items-center py-4">
          <ActivityIndicator />
        </View>
      </AuthLayout>
    );
  }

  if (linkState === 'invalid') {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Invalid reset link"
        subtitle="This password reset link is missing or invalid"
        footer={
          <Text className="text-sm font-medium text-primary" onPress={() => router.replace('/forgot-password')}>
            Request a new link
          </Text>
        }>
        <Text className="text-center text-sm">The link you used appears to be incomplete or has expired. Please request a new password reset email.</Text>
        {linkError ? <Text className="mt-3 text-center text-xs text-muted-foreground">{linkError}</Text> : null}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={Lock} title="New password" subtitle="Enter your new password below">
      <AuthError message={error} />
      <View className="gap-4">
        <AuthField label="New Password" icon={Lock}>
          <Input
            value={newPassword}
            onChangeText={setNewPassword}
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
        <Button className="h-12" onPress={handleSubmit} loading={loading} disabled={!newPassword}>
          {loading ? 'Resetting...' : 'Reset password'}
        </Button>
      </View>
    </AuthLayout>
  );
}
