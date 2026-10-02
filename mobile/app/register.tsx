import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { UserPlus } from 'lucide-react-native';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await register(email, password);
      setMessage('Check your email for a confirmation link or verification code.');
      router.replace('/login');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

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
        <Input
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        {message ? <Text className="text-sm text-primary">{message}</Text> : null}
        <Button label={loading ? 'Creating…' : 'Create account'} onPress={onSubmit} disabled={loading} />
        {loading ? <ActivityIndicator /> : null}
      </View>
    </AuthLayout>
  );
}
