import { useRouter } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import GoogleIcon from '@/components/GoogleIcon';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { resendSignupOtp, signInWithGoogle, verifyEmailOtp } from '@/lib/supabaseAuth';

function Field({ label, icon, extra, children }: { label: string; icon: any; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View>
      <View className="mb-1.5 flex-row items-center justify-between">
        <Label className="mb-0">{label}</Label>
        {extra}
      </View>
      <View className="justify-center">
        <View pointerEvents="none" className="absolute left-3 z-10">
          <Icon as={icon} size={16} className="text-muted-foreground" />
        </View>
        {children}
      </View>
    </View>
  );
}

/** Sign-in sheet opened by `requireAuth()` — mirrors the web AuthModal (login / register / email OTP / Google). */
export default function AuthModal() {
  const router = useRouter();
  const { isLoginModalOpen, onLoginModalOpenChange, finishLogin, signInWithPassword, signUp } = useAuth();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const handleOpenChange = (open: boolean) => {
    if (!open && loading) return;
    if (!open) {
      setShowOtp(false);
      setOtpCode('');
      setError('');
    }
    onLoginModalOpenChange(open);
  };

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (err: any) {
      setError(err?.message || fallback);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () =>
    run(async () => {
      const session = await signInWithGoogle();
      if (session) await finishLogin();
    }, 'Google sign-in failed');

  const handleLogin = () =>
    run(async () => {
      await signInWithPassword(email, password);
      await finishLogin();
    }, 'Invalid email or password');

  const handleRegister = () =>
    run(async () => {
      if (password !== confirmPassword) throw new Error('Passwords do not match');
      const result = await signUp(email, password);
      if (result?.session) await finishLogin();
      else setShowOtp(true);
    }, 'Registration failed');

  const handleVerify = () =>
    run(async () => {
      await verifyEmailOtp(email, otpCode);
      await finishLogin();
      setShowOtp(false);
      setOtpCode('');
    }, 'Invalid verification code');

  const handleResend = async () => {
    setError('');
    try {
      await resendSignupOtp(email);
      toast({ title: 'Code sent', description: 'Check your email for the new code.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code');
    }
  };

  return (
    <Dialog
      open={isLoginModalOpen}
      onOpenChange={handleOpenChange}
      variant="sheet"
      title={showOtp ? 'Verify your email' : 'Continue'}
      description={showOtp ? `We sent a code to ${email}` : 'Browse freely. Sign in when you want to upload, export, or connect.'}>
      {error ? (
        <View className="mb-3 rounded-xl bg-destructive/10 p-3">
          <Text className="text-sm text-destructive">{error}</Text>
        </View>
      ) : null}

      {showOtp ? (
        <View className="gap-4 pb-2">
          <Input
            value={otpCode}
            onChangeText={(v) => setOtpCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="h-14 text-center text-2xl tracking-widest"
          />
          <Button className="h-12 rounded-xl" onPress={handleVerify} loading={loading} disabled={otpCode.length < 6}>
            Verify
          </Button>
          <View className="flex-row items-center justify-center gap-1">
            <Text className="text-sm text-muted-foreground">Didn&apos;t receive the code?</Text>
            <Pressable onPress={handleResend} hitSlop={8}>
              <Text className="text-sm font-semibold text-primary">Resend</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="gap-4 pb-2">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v);
              setError('');
            }}
            items={[
              { value: 'login', label: 'Log in' },
              { value: 'register', label: 'Create account' },
            ]}
          />

          <Button variant="outline" className="h-12 rounded-xl" onPress={handleGoogle} disabled={loading}>
            <GoogleIcon size={20} />
            <Text className="text-sm font-semibold">Continue with Google</Text>
          </Button>

          <View className="flex-row items-center gap-3">
            <View className="h-px flex-1 bg-border" />
            <Text className="text-xs uppercase text-muted-foreground">or</Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          <Field label="Email" icon={Mail}>
            <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" className="h-12 rounded-xl pl-10" />
          </Field>
          <Field
            label="Password"
            icon={Lock}
            extra={
              tab === 'login' ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    handleOpenChange(false);
                    router.push('/forgot-password');
                  }}>
                  <Text className="text-xs font-semibold text-primary">Forgot password?</Text>
                </Pressable>
              ) : null
            }>
            <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete={tab === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••" className="h-12 rounded-xl pl-10" />
          </Field>
          {tab === 'register' ? (
            <Field label="Confirm password" icon={Lock}>
              <Input value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" placeholder="••••••••" className="h-12 rounded-xl pl-10" />
            </Field>
          ) : null}
          <Button className="h-12 rounded-xl" onPress={tab === 'login' ? handleLogin : handleRegister} loading={loading}>
            {tab === 'login' ? 'Log in' : 'Create account'}
          </Button>
        </View>
      )}
    </Dialog>
  );
}
