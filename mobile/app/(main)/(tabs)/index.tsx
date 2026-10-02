import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Plus, Settings } from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import { loadCampaigns } from '@/services/data';
import { Button } from '@/components/ui/Button';

export default function DashboardScreen() {
  const router = useRouter();
  const { isAuthenticated, requireAuth } = useAuth();
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title?: string; status?: string }>>(
    [],
  );
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    setError('');
    loadCampaigns()
      .then((rows) => setCampaigns(rows || []))
      .catch((e: Error) => {
        setCampaigns([]);
        setError(isAuthenticated ? e.message || 'Could not load campaigns.' : '');
      });
  }, [isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload]);

  const active = campaigns.find((c) => ['active', 'scheduled', 'preparing'].includes(c.status || ''));

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-4 pb-10">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-heading text-3xl font-bold text-foreground">
            MusicPromo <Text className="text-primary">AI</Text>
          </Text>
          <Text className="mt-2 text-base text-muted-foreground">
            Hands-off promo: auto videos, scheduled publishing, and live analytics.
          </Text>
        </View>
        <Link href="/settings" asChild>
          <Pressable className="rounded-xl border border-border p-2">
            <Settings color="#64748b" size={22} />
          </Pressable>
        </Link>
      </View>

      {!isAuthenticated ? (
        <View className="rounded-2xl border border-border bg-card p-4">
          <Text className="text-base text-foreground">Sign in to save campaigns and sync your studio.</Text>
          <View className="mt-3">
            <Button label="Sign in" onPress={() => router.push('/login')} />
          </View>
        </View>
      ) : null}

      {error ? <Text className="text-destructive">{error}</Text> : null}

      <View className="flex-row flex-wrap gap-2">
        <Button
          label="New Campaign"
          className="flex-1 min-w-[45%]"
          onPress={() => {
            if (!requireAuth(() => router.push('/create'))) router.push('/login');
          }}
        />
        <Button
          variant="outline"
          label="All Campaigns"
          className="flex-1 min-w-[45%]"
          onPress={() => router.push('/campaigns')}
        />
      </View>

      {active ? (
        <Pressable
          className="rounded-2xl border border-border bg-card p-4"
          onPress={() => router.push(`/campaigns/${active.id}`)}
        >
          <Text className="text-xs uppercase tracking-wide text-muted-foreground">Active campaign</Text>
          <Text className="mt-1 text-lg font-semibold text-foreground">{active.title || 'Untitled'}</Text>
          <Text className="mt-1 text-sm capitalize text-primary">{active.status}</Text>
        </Pressable>
      ) : (
        <View className="items-center rounded-2xl border border-dashed border-border p-8">
          <Plus color="#64748b" size={28} />
          <Text className="mt-2 text-center text-muted-foreground">No active campaigns yet.</Text>
        </View>
      )}

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Recent</Text>
        {campaigns.slice(0, 6).map((c) => (
          <Pressable
            key={c.id}
            className="rounded-xl border border-border bg-card px-4 py-3"
            onPress={() => router.push(`/campaigns/${c.id}`)}
          >
            <Text className="font-medium text-foreground">{c.title || 'Untitled campaign'}</Text>
            <Text className="text-sm capitalize text-muted-foreground">{c.status || 'draft'}</Text>
          </Pressable>
        ))}
        {!campaigns.length && !error ? (
          <Text className="text-muted-foreground">Campaigns you create will show up here.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
