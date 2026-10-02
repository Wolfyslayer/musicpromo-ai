// @ts-nocheck
import { View, Text, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '@/api/db';

import { useState } from "react";
import { Sparkles, RefreshCw, Loader2, Clock, Film, Lightbulb } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';

import { aiService } from "@/services/aiService";
import { useToast } from '@/lib/toast';

/**
 * Song Analysis section: shows the AI-generated song profile, content
 * opportunities, and the (estimated) best promotional moment.
 *
 * Real functionality: AI analysis via analyzeSong.
 * Clearly marked: the promotional moment is an ESTIMATE — no real audio
 * analysis service is connected.
 */
export default function SongAnalysis({ song, onRefresh }) {
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingMoment, setLoadingMoment] = useState(false);
  const { toast } = useToast();
  const analysis = song?.analysis;
  const hasAnalysis = analysis && analysis.genre;

  const generateAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const result = await aiService.analyzeSong({ ...song, artistName: song.artistName });
      await db.entities.Song.update(song.id, { analysis: result });
      toast({ title: "Song analysis generated" });
      onRefresh();
    } catch (e) {
      toast({ variant: "destructive", title: "Analysis failed", description: e.message });
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
      toast({ title: "Promotional moment estimated" });
      onRefresh();
    } catch (e) {
      toast({ variant: "destructive", title: "Failed", description: e.message });
    } finally {
      setLoadingMoment(false);
    }
  };

  return (
    <View className="space-y-4">
      <View className="flex items-center justify-between">
        <View className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">AI Song Analysis</View>
        <Button variant="outline" onPress={generateAnalysis} disabled={loadingAnalysis} className="rounded-full">
          {loadingAnalysis ? <Loader2 /> : <Sparkles />}
          {hasAnalysis ? "Regenerate Analysis" : "Generate Analysis"}
        </Button>
      </View>

      {loadingAnalysis && (
        <View className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-6">
          <Loader2 />
          <View className="text-sm text-muted-foreground">Analyzing song…</View>
        </View>
      )}

      {!hasAnalysis && !loadingAnalysis && (
        <View className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-center">
          <Lightbulb />
          <View className="text-sm text-muted-foreground">No analysis yet. Generate one to unlock hooks, captions and campaign strategy.</View>
        </View>
      )}

      {hasAnalysis && !loadingAnalysis && (
        <>
          {/* Profile cards */}
          <View className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Genre", value: [analysis.genre, analysis.subgenre].filter(Boolean).join(" · ") },
              { label: "Mood", value: analysis.mood },
              { label: "Energy", value: analysis.energy },
              { label: "Emotional Tone", value: analysis.emotionalTone },
            ].filter((c) => c.value).map((c) => (
              <View key={c.label} className="rounded-2xl border border-border/60 bg-card/50 p-3">
                <View className="text-xs text-muted-foreground">{c.label}</View>
                <View className="mt-1 text-sm font-600">{c.value}</View>
              </View>
            ))}
          </View>

          {/* Theme lists */}
          <View className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Themes", items: analysis.themes },
              { label: "Lyrical Themes", items: analysis.lyricalThemes },
              { label: "Audience Themes", items: analysis.audienceThemes },
              { label: "Target Audiences", items: analysis.targetAudiences },
              { label: "Promotional Angles", items: analysis.promotionalAngles },
              { label: "Recommended Platforms", items: analysis.recommendedPlatforms },
            ].filter((l) => l.items?.length).map((l) => (
              <View key={l.label} className="rounded-2xl border border-border/60 bg-card/50 p-4">
                <View className="mb-2 text-xs font-600 uppercase tracking-wider text-muted-foreground">{l.label}</View>
                <View className="flex flex-wrap gap-1.5">
                  {l.items.map((it, i) => <View key={i} className="rounded-full bg-muted/50 px-2.5 py-1 text-xs">{it}</View>)}
                </View>
              </View>
            ))}
          </View>

          {/* Content Opportunities */}
          {analysis.contentOpportunities?.length > 0 && (
            <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
              <View className="mb-3 text-xs font-600 uppercase tracking-wider text-muted-foreground">Content Opportunities</View>
              <View className="space-y-2">
                {analysis.contentOpportunities.map((opp, i) => (
                  <View key={i} className="rounded-xl bg-muted/30 p-3">
                    <View className="flex items-center gap-2">
                      <View className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wider text-primary">{formatType(opp.type)}</View>
                      <View className="text-sm font-600">{opp.title}</View>
                    </View>
                    <View className="mt-1 text-xs text-muted-foreground">{opp.description}</View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Best Promotional Moment */}
          <PromotionalMoment moment={analysis.promotionalMoment} loading={loadingMoment} onRegenerate={regenerateMoment} />
        </>
      )}
    </View>
  );
}

function PromotionalMoment({ moment, loading, onRegenerate }) {
  return (
    <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <View className="flex items-center justify-between">
        <View className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Best Promotional Moment</View>
        <Button variant="ghost" onPress={onRegenerate} disabled={loading} className="h-7 rounded-full text-xs">
          {loading ? <Loader2 /> : <RefreshCw />}Regenerate
        </Button>
      </View>
      {moment ? (
        <View className="mt-3 space-y-2">
          {moment.isEstimated && (
            <View className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-600 uppercase tracking-wider text-yellow-500/90">Estimated — audio analysis service not connected</View>
          )}
          {moment.startTime && moment.endTime && (
            <View className="flex items-center gap-2 text-lg font-heading font-700">
              <Clock />{moment.startTime}–{moment.endTime}
            </View>
          )}
          <View>
            <View className="text-xs text-muted-foreground">Reason</View>
            <View className="text-sm">{moment.reason}</View>
          </View>
          <View>
            <View className="text-xs text-muted-foreground">Recommended use</View>
            <View className="flex items-center gap-1.5 text-sm"><Film />{moment.suggestedContentType}</View>
          </View>
        </View>
      ) : (
        <View className="mt-2 text-sm text-muted-foreground">No promotional moment estimated yet. This will be an estimate — real timestamps require an audio analysis service.</View>
      )}
    </View>
  );
}

function formatType(t = "") {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
