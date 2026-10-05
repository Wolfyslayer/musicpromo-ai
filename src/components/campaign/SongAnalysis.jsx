import { db } from '@/api/base44Client';

import { useState } from "react";
import { Sparkles, RefreshCw, Loader2, Clock, Film, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

import { aiService } from "@/services/aiService";
import { billingFailureToast } from "@/lib/billingErrors";
import { normalizeSongForAI } from "@/services/songLanguage";
import { useToast } from "@/components/ui/use-toast";

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
      const result = await aiService.analyzeSong(normalizeSongForAI(song, song.artistName));
      await db.entities.Song.update(song.id, { analysis: result });
      toast({ title: "Song analysis generated" });
      onRefresh();
    } catch (e) {
      const fail = billingFailureToast(e);
      toast({ variant: "destructive", title: fail.title === "Request failed" ? "Analysis failed" : fail.title, description: fail.description });
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const regenerateMoment = async () => {
    setLoadingMoment(true);
    try {
      const moment = await aiService.analyzePromotionalMoment({
        song: normalizeSongForAI(song, song.artistName),
        analysis,
      });
      await db.entities.Song.update(song.id, {
        analysis: { ...(analysis || {}), promotionalMoment: moment },
      });
      toast({ title: "Promotional moment estimated" });
      onRefresh();
    } catch (e) {
      const fail = billingFailureToast(e);
      toast({ variant: "destructive", title: fail.title, description: fail.description });
    } finally {
      setLoadingMoment(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">AI Song Analysis</h2>
        <Button size="sm" variant="outline" onClick={generateAnalysis} disabled={loadingAnalysis} className="rounded-full">
          {loadingAnalysis ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          {hasAnalysis ? "Regenerate Analysis" : "Generate Analysis"}
        </Button>
      </div>

      {loadingAnalysis && (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analyzing song…</p>
        </div>
      )}

      {!hasAnalysis && !loadingAnalysis && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-center">
          <Lightbulb className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No analysis yet. Generate one to unlock hooks, captions and campaign strategy.</p>
        </div>
      )}

      {hasAnalysis && !loadingAnalysis && (
        <>
          {/* Profile cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Genre", value: [analysis.genre, analysis.subgenre].filter(Boolean).join(" · ") },
              { label: "Mood", value: analysis.mood },
              { label: "Energy", value: analysis.energy },
              { label: "Emotional Tone", value: analysis.emotionalTone },
            ].filter((c) => c.value).map((c) => (
              <div key={c.label} className="rounded-2xl border border-border/60 bg-card/50 p-3">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-sm font-600">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Theme lists */}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Themes", items: analysis.themes },
              { label: "Lyrical Themes", items: analysis.lyricalThemes },
              { label: "Audience Themes", items: analysis.audienceThemes },
              { label: "Target Audiences", items: analysis.targetAudiences },
              { label: "Promotional Angles", items: analysis.promotionalAngles },
              { label: "Recommended Platforms", items: analysis.recommendedPlatforms },
            ].filter((l) => l.items?.length).map((l) => (
              <div key={l.label} className="rounded-2xl border border-border/60 bg-card/50 p-4">
                <p className="mb-2 text-xs font-600 uppercase tracking-wider text-muted-foreground">{l.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {l.items.map((it, i) => <span key={i} className="rounded-full bg-muted/50 px-2.5 py-1 text-xs">{it}</span>)}
                </div>
              </div>
            ))}
          </div>

          {/* Content Opportunities */}
          {analysis.contentOpportunities?.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
              <p className="mb-3 text-xs font-600 uppercase tracking-wider text-muted-foreground">Content Opportunities</p>
              <div className="space-y-2">
                {analysis.contentOpportunities.map((opp, i) => (
                  <div key={i} className="rounded-xl bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wider text-primary">{formatType(opp.type)}</span>
                      <p className="text-sm font-600">{opp.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{opp.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best Promotional Moment */}
          <PromotionalMoment moment={analysis.promotionalMoment} loading={loadingMoment} onRegenerate={regenerateMoment} />
        </>
      )}
    </div>
  );
}

function PromotionalMoment({ moment, loading, onRegenerate }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Best Promotional Moment</p>
        <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={loading} className="h-7 rounded-full text-xs">
          {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}Regenerate
        </Button>
      </div>
      {moment ? (
        <div className="mt-3 space-y-2">
          {moment.isEstimated && (
            <p className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-600 uppercase tracking-wider text-yellow-500/90">Estimated — audio analysis service not connected</p>
          )}
          {moment.startTime && moment.endTime && (
            <p className="flex items-center gap-2 text-lg font-heading font-semibold">
              <Clock className="h-4 w-4 text-primary" />{moment.startTime}–{moment.endTime}
            </p>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Reason</p>
            <p className="text-sm">{moment.reason}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recommended use</p>
            <p className="flex items-center gap-1.5 text-sm"><Film className="h-3.5 w-3.5 text-primary" />{moment.suggestedContentType}</p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No promotional moment estimated yet. This will be an estimate — real timestamps require an audio analysis service.</p>
      )}
    </div>
  );
}

function formatType(t = "") {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
