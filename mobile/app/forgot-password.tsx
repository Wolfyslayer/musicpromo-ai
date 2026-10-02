import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { KeyRound } from 'lucide-react-native';
import { db } from '@/api/db';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await db.auth.resetPasswordRequest(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={KeyRound}
      title="Reset password"
      subtitle="We will email you a reset link"
      footer={
        <Text className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary">
            Back to sign in
          </Link>
        </Text>
      }
    >
      <View className="gap-4">
        <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        {sent ? (
          <Text className="text-sm text-primary">If an account exists, a reset link was sent.</Text>
        ) : null}
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        <Button label={loading ? 'Sending…' : 'Send reset link'} onPress={onSubmit} disabled={loading || sent} />
      </View>
    </AuthLayout>
  );
}
