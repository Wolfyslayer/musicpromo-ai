import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarDays, ListChecks, Share2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ArtworkImage from '@/components/ArtworkImage';
import ContentWorkspace from '@/components/campaign/ContentWorkspace';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { loadCampaignContent } from '@/services/data';

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1.5 self-start">
      <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
      <Text className="text-sm text-muted-foreground">{label}</Text>
    </Pressable>
  );
}

export default function CampaignContent() {
  const { id, day } = useLocalSearchParams<{ id: string; day?: string }>();
  const focusDayId = day || null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const workspaceY = useRef(0);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const reload = useCallback(
    () =>
      loadCampaignContent(id)
        .then(setData)
        .catch((e: any) => setError(e.message || 'Failed to load content')),
    [id]
  );

  useEffect(() => {
    setError('');
    setData(null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const scrollToDay = useCallback((y: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, workspaceY.current + y - 8), animated: true });
  }, []);

  const shell = (children: React.ReactNode) => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background">
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
        <View className="gap-5">{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (error) {
    return shell(
      <>
        <BackLink label="Back to campaigns" onPress={() => router.navigate('/campaigns')} />
        <Text className="text-destructive">{error}</Text>
      </>
    );
  }

  if (!data) return shell(<Skeleton className="h-64 rounded-2xl" />);

  const { campaign, song, artist, release, days, content, videos } = data;

  return shell(
    <>
      <BackLink label="Back to Campaign" onPress={() => router.navigate(`/campaigns/${id}` as any)} />

      <View className="gap-4 rounded-3xl border border-border/60 bg-card p-5">
        <ArtworkImage src={release?.artwork_url || song?.artwork_url} alt={song?.title || campaign.name} className="size-28 self-center" rounded="rounded-2xl" />
        <View>
          <View className="flex-row flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status || 'draft'} />
            <View className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5">
              <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">Content Workspace</Text>
            </View>
          </View>
          <Text className="mt-2 font-heading-bold text-2xl" numberOfLines={2}>
            {song?.title || campaign.name || 'Campaign Content'}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {artist?.name || 'Unknown artist'}
            {release?.title ? ` · ${release.title}` : ''}
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onPress={() => router.push(`/campaigns/${id}?tab=plan` as any)}>
              <Icon as={ListChecks} size={14} />
              <Text className="text-xs font-medium">Plan</Text>
            </Button>
            {campaign.release_id ? (
              <Button variant="outline" size="sm" className="rounded-full" onPress={() => router.push(`/releases/${campaign.release_id}/calendar` as any)}>
                <Icon as={CalendarDays} size={14} />
                <Text className="text-xs font-medium">Calendar</Text>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" className="rounded-full" onPress={() => router.push('/social' as any)}>
              <Icon as={Share2} size={14} />
              <Text className="text-xs font-medium">Social</Text>
            </Button>
          </View>
        </View>
      </View>

      <View onLayout={(e) => (workspaceY.current = e.nativeEvent.layout.y + 16)}>
        <ContentWorkspace
          campaign={campaign}
          song={song}
          artist={artist}
          release={release}
          days={days}
          content={content}
          videos={videos}
          onRefresh={reload}
          focusDayId={focusDayId}
          embedLibrary
          onFocusDayLayout={scrollToDay}
        />
      </View>
    </>
  );
}
