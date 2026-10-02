import { db } from '@/api/base44Client';

import { Clock, Film, Lightbulb, RefreshCw, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { aiService } from '@/services/aiService';

/**
 * Song Analysis section: AI-generated song profile, content opportunities,
 * and the (estimated) best promotional moment.
 */
export default function SongAnalysis({ song, onRefresh }: { song: any; onRefresh: () => void }) {
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingMoment, setLoadingMoment] = useState(false);
  const analysis = song?.analysis;
  const hasAnalysis = analysis && analysis.genre;

  const generateAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const result = await aiService.analyzeSong({ ...song, artistName: song.artistName });
      await db.entities.Song.update(song.id, { analysis: result });
      toast({ title: 'Song analysis generated' });
      onRefresh();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Analysis failed', description: e.message });
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const regenerateMoment = async () => {
    setLoadingMoment(true);
    try {
      const moment = await aiService.analyzePromotionalMoment({ song, analysis });
      await db.entities.Song.update(song.id, {
        analysis: { ...(analysis || {}), promotionalMoment: moment },
      });
      toast({ title: 'Promotional moment estimated' });
      onRefresh();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    } finally {
      setLoadingMoment(false);
    }
  };

  const profile = hasAnalysis
    ? [
        { label: 'Genre', value: [analysis.genre, analysis.subgenre].filter(Boolean).join(' · ') },
        { label: 'Mood', value: analysis.mood },
        { label: 'Energy', value: analysis.energy },
        { label: 'Emotional Tone', value: analysis.emotionalTone },
      ].filter((c) => c.value)
    : [];

  const lists = hasAnalysis
    ? [
        { label: 'Themes', items: analysis.themes },
        { label: 'Lyrical Themes', items: analysis.lyricalThemes },
        { label: 'Audience Themes', items: analysis.audienceThemes },
        { label: 'Target Audiences', items: analysis.targetAudiences },
        { label: 'Promotional Angles', items: analysis.promotionalAngles },
        { label: 'Recommended Platforms', items: analysis.recommendedPlatforms },
      ].filter((l) => l.items?.length)
    : [];

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 font-heading text-sm uppercase tracking-wider text-muted-foreground">AI Song Analysis</Text>
        <Button size="sm" variant="outline" onPress={generateAnalysis} disabled={loadingAnalysis} loading={loadingAnalysis} className="rounded-full">
          {!loadingAnalysis ? <Icon as={Sparkles} size={14} /> : null}
          <Text className="text-xs font-medium">{hasAnalysis ? 'Regenerate Analysis' : 'Generate Analysis'}</Text>
        </Button>
      </View>

      {loadingAnalysis ? (
        <View className="flex-row items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-6">
          <ActivityIndicator />
          <Text className="text-sm text-muted-foreground">Analyzing song…</Text>
        </View>
      ) : null}

      {!hasAnalysis && !loadingAnalysis ? (
        <View className="items-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6">
          <Icon as={Lightbulb} size={24} className="mb-2 text-muted-foreground" />
          <Text className="text-center text-sm text-muted-foreground">No analysis yet. Generate one to unlock hooks, captions and campaign strategy.</Text>
        </View>
      ) : null}

      {hasAnalysis && !loadingAnalysis ? (
        <>
          <View className="flex-row flex-wrap gap-3">
            {profile.map((c) => (
              <View key={c.label} className="w-[48%] flex-grow rounded-2xl border border-border/60 bg-card/50 p-3">
                <Text className="text-xs text-muted-foreground">{c.label}</Text>
                <Text className="mt-1 text-sm font-semibold">{c.value}</Text>
              </View>
            ))}
          </View>

          <View className="gap-3">
            {lists.map((l) => (
              <View key={l.label} className="rounded-2xl border border-border/60 bg-card/50 p-4">
                <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{l.label}</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {l.items.map((it: string, i: number) => (
                    <View key={i} className="rounded-full bg-muted/50 px-2.5 py-1">
                      <Text className="text-xs">{it}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {analysis.contentOpportunities?.length > 0 ? (
            <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
              <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content Opportunities</Text>
              <View className="gap-2">
                {analysis.contentOpportunities.map((opp: any, i: number) => (
                  <View key={i} className="rounded-xl bg-muted/30 p-3">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <View className="rounded-full bg-primary/15 px-2 py-0.5">
                        <Text className="text-[10px] font-semibold uppercase tracking-wider text-primary">{formatType(opp.type)}</Text>
                      </View>
                      <Text className="flex-shrink text-sm font-semibold">{opp.title}</Text>
                    </View>
                    <Text className="mt-1 text-xs text-muted-foreground">{opp.description}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <PromotionalMoment moment={analysis.promotionalMoment} loading={loadingMoment} onRegenerate={regenerateMoment} />
        </>
      ) : null}
    </View>
  );
}

function PromotionalMoment({ moment, loading, onRegenerate }: { moment: any; loading: boolean; onRegenerate: () => void }) {
  return (
    <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Best Promotional Moment</Text>
        <Button size="sm" variant="ghost" onPress={onRegenerate} disabled={loading} loading={loading} className="h-8 rounded-full">
          {!loading ? <Icon as={RefreshCw} size={12} /> : null}
          <Text className="text-xs font-medium">Regenerate</Text>
        </Button>
      </View>
      {moment ? (
        <View className="mt-3 gap-2">
          {moment.isEstimated ? (
            <View className="self-start rounded-full bg-chart-4/10 px-2.5 py-0.5">
              <Text className="text-[10px] font-semibold uppercase tracking-wider text-chart-4">Estimated — audio analysis service not connected</Text>
            </View>
          ) : null}
          {moment.startTime && moment.endTime ? (
            <View className="flex-row items-center gap-2">
              <Icon as={Clock} size={16} className="text-primary" />
              <Text className="font-heading-bold text-lg">
                {moment.startTime}–{moment.endTime}
              </Text>
            </View>
          ) : null}
          <View>
            <Text className="text-xs text-muted-foreground">Reason</Text>
            <Text className="text-sm">{moment.reason}</Text>
          </View>
          <View>
            <Text className="text-xs text-muted-foreground">Recommended use</Text>
            <View className="flex-row items-center gap-1.5">
              <Icon as={Film} size={14} className="text-primary" />
              <Text className="flex-1 text-sm">{moment.suggestedContentType}</Text>
            </View>
          </View>
        </View>
      ) : (
        <Text className="mt-2 text-sm text-muted-foreground">No promotional moment estimated yet. This will be an estimate — real timestamps require an audio analysis service.</Text>
      )}
    </View>
  );
}

function formatType(t = '') {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
