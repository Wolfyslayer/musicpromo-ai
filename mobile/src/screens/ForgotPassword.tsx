import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { db } from '@/api/base44Client';
import AuthLayout, { AuthField } from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
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

  return (
    <AuthLayout
      icon={Mail}
      title="Reset password"
      subtitle="We'll send you a link to reset it"
      footer={
        <Pressable hitSlop={8} className="flex-row items-center gap-1" onPress={() => router.replace('/login')}>
          <Icon as={ArrowLeft} size={12} className="text-primary" />
          <Text className="text-sm font-medium text-primary">Back to log in</Text>
        </Pressable>
      }>
      {sent ? (
        <Text className="text-center text-sm">If an account exists with that email, you&apos;ll receive a password reset link shortly.</Text>
      ) : (
        <>
          <AuthField label="Email address" icon={Mail}>
            <Input
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
              placeholder="you@example.com"
              className="h-12 pl-10"
            />
          </AuthField>
          <Button className="mt-4 h-12" onPress={handleSubmit} loading={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </Button>
        </>
      )}
    </AuthLayout>
  );
}
