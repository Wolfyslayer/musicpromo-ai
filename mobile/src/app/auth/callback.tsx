import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { toast } from '@/components/ui/use-toast';
import { createSessionFromUrl } from '@/lib/supabaseAuth';

/** Landing route for `promostudio://auth/callback` deep links (OAuth return, email confirmation). */
export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (url) await createSessionFromUrl(url);
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Sign-in failed', description: err?.message });
      } finally {
        if (!cancelled) router.replace('/');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, router]);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator />
    </View>
  );
}
