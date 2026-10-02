import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { db } from '@/api/db';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await db.auth.resetPassword({ newPassword: password });
      router.replace('/login');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout icon={ShieldCheck} title="Choose a new password" subtitle="Open this screen from your email link">
      <View className="gap-4">
        <Input label="New password" secureTextEntry value={password} onChangeText={setPassword} />
        <Input label="Confirm password" secureTextEntry value={confirm} onChangeText={setConfirm} />
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        <Button label={loading ? 'Saving…' : 'Update password'} onPress={onSubmit} disabled={loading} />
      </View>
    </AuthLayout>
  );
}
