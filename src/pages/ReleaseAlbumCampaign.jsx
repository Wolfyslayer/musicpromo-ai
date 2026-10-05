import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Rocket, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import SurfacePanel from "@/components/SurfacePanel";
import ArtworkImage from "@/components/ArtworkImage";
import { loadRelease } from "@/services/data";
import { CAMPAIGN_DURATIONS, CAMPAIGN_GOALS } from "@/services/constants";
import { generateCampaignForSong } from "@/services/createCampaignCore";
import { sortReleaseTracks, staggeredStartDate } from "@/services/releaseTracks";
import { todayISO } from "@/services/format";
import { billingFailureToast } from "@/lib/billingErrors";
import { getSettings } from "@/services/settings";

const STEPS = ["Tracks", "Rollout", "Generate", "Social"];

export default function ReleaseAlbumCampaign() {
  const { id: releaseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState("");
  const [results, setResults] = useState([]);

  const settings = getSettings();
  const [rollout, setRollout] = useState({
    goals: ["Promote an album", "Increase streams"],
    durationDays: settings.defaultDuration || 14,
    startDate: todayISO(),
    daysBetweenTracks: 7,
    promoStylePreset: settings.defaultTemplate ? "viral-pop" : "viral-pop",
  });

  const reload = () =>
    loadRelease(releaseId)
      .then(setData)
      .catch(() => setData(null));

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [releaseId]);

  useEffect(() => {
    if (data?.release?.release_date) {
      setRollout((r) => ({ ...r, startDate: data.release.release_date }));
    }
  }, [data?.release?.release_date]);

  const songs = useMemo(() => sortReleaseTracks(data?.songs || []), [data?.songs]);
  const campaigns = data?.campaigns || [];
  const campaignBySong = useMemo(
    () => Object.fromEntries(campaigns.map((c) => [c.song_id, c])),
    [campaigns]
  );
  const needsCampaign = songs.filter((s) => !campaignBySong[s.id]);

  const toggleGoal = (g) =>
    setRollout((r) => ({
      ...r,
      goals: r.goals.includes(g) ? r.goals.filter((x) => x !== g) : [...r.goals, g],
    }));

  const runBatch = async () => {
    setGenerating(true);
    setResults([]);
    const out = [];
    try {
      for (let i = 0; i < needsCampaign.length; i++) {
        const song = needsCampaign[i];
        const trackIndex = songs.findIndex((s) => s.id === song.id);
        const startDate = staggeredStartDate(rollout.startDate, trackIndex, rollout.daysBetweenTracks);
        setStage(`Track ${trackIndex + 1}/${songs.length}: ${song.title}`);
        const { campaign } = await generateCampaignForSong({
          song,
          artist: data.artist,
          releaseId,
          goals: rollout.goals,
          durationDays: rollout.durationDays,
          startDate,
          promoStylePreset: rollout.promoStylePreset,
          userId: user?.id || "",
          onStage: setStage,
        });
        out.push({ songId: song.id, campaignId: campaign.id, title: song.title });
      }
      setResults(out);
      toast({
        title: out.length ? `${out.length} campaign plan${out.length === 1 ? "" : "s"} created` : "All tracks already had campaigns",
      });
      await reload();
      setStep(3);
    } catch (e) {
      const fail = billingFailureToast(e);
      toast({ variant: "destructive", title: fail.title, description: fail.description });
    } finally {
      setGenerating(false);
      setStage("");
    }
  };

  if (loading) return <div className="h-64 animate-shimmer rounded-2xl" />;
  if (!data?.release) {
    return (
      <p className="text-destructive">
        Release not found.{" "}
        <Link to="/releases" className="underline">
          Back to releases
        </Link>
      </p>
    );
  }

  const { release, artist } = data;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(`/releases/${releaseId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to release
      </button>

      <PageHeader
        eyebrow="Release → Campaign → Social"
        title="Plan album rollout"
        description="Build campaigns for every track, then publish from the launch board and Social Hub."
      />

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {i < step ? <Check className="mr-1 inline h-3 w-3" /> : null}
            {label}
          </span>
        ))}
      </div>

      <SurfacePanel>
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <ArtworkImage src={release.artwork_url} alt={release.title} className="h-20 w-20 shrink-0" rounded="rounded-xl" />
              <div>
                <p className="font-heading text-lg font-semibold">{release.title}</p>
                <p className="text-sm text-muted-foreground">{artist?.name}</p>
              </div>
            </div>
            {!songs.length ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Add tracks on the release editor first, then return here.
                <Button type="button" variant="link" className="h-auto p-0 pl-1" onClick={() => navigate(`/releases/${releaseId}/edit`)}>
                  Edit release & tracklist
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border/50 rounded-xl border border-border/60">
                {songs.map((s, i) => {
                  const camp = campaignBySong[s.id];
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>
                        <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
                        {s.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {camp ? "Campaign ready" : "Needs campaign"}
                        {!s.audio_url ? " · add audio in single-track flow" : ""}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => navigate(`/create?release=${releaseId}&song=${s.id}`)}
                      >
                        {camp ? "Open track" : "Full setup"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Shared plan settings for each new campaign. Stagger start dates so singles can drop weekly before album day.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Campaign start (track 1)</Label>
                <Input
                  type="date"
                  value={rollout.startDate}
                  onChange={(e) => setRollout((r) => ({ ...r, startDate: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Days between track campaigns</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={rollout.daysBetweenTracks}
                  onChange={(e) => setRollout((r) => ({ ...r, daysBetweenTracks: Number(e.target.value) }))}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">0 = all tracks share the same start date.</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Plan length (per track)</Label>
                <div className="flex flex-wrap gap-2">
                  {CAMPAIGN_DURATIONS.map((d) => (
                    <button
                      key={d.days}
                      type="button"
                      onClick={() => setRollout((r) => ({ ...r, durationDays: d.days }))}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        rollout.durationDays === d.days ? "border-primary bg-primary/10 text-primary" : "border-border"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Goals</Label>
              <div className="flex flex-wrap gap-2">
                {CAMPAIGN_GOALS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGoal(g)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      rollout.goals.includes(g) ? "border-primary bg-primary/10 text-primary" : "border-border"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {generating ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                {stage || "Generating…"}
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Creates AI campaign plans for <strong>{needsCampaign.length}</strong> track
                  {needsCampaign.length === 1 ? "" : "s"} without campaigns. Tracks that already have campaigns are skipped.
                </p>
                {needsCampaign.length === 0 ? (
                  <p className="text-sm text-primary">Every track already has a campaign — continue to social setup.</p>
                ) : null}
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Release rollout is ready for social publishing.
            </p>
            {results.length ? (
              <ul className="text-sm text-muted-foreground">
                {results.map((r) => (
                  <li key={r.campaignId}>
                    {r.title} → campaign created
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="rounded-full" onClick={() => navigate(`/releases/${releaseId}/launch`)}>
                <Rocket className="mr-1.5 h-4 w-4" /> Launch board
              </Button>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate("/social/connect")}>
                <Share2 className="mr-1.5 h-4 w-4" /> Connect platforms
              </Button>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate("/social")}>
                Social Hub
              </Button>
            </div>
            {release.presave_url ? (
              <p className="text-xs text-muted-foreground">
                Pre-save link on this release:{" "}
                <a href={release.presave_url} className="text-primary underline" target="_blank" rel="noreferrer">
                  {release.presave_url}
                </a>
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <Button type="button" variant="ghost" className="rounded-full" disabled={step === 0 || generating} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          {step < 2 && (
            <Button
              type="button"
              className="rounded-full"
              disabled={step === 0 && !songs.length}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
          {step === 2 && !generating && (
            <Button
              type="button"
              className="rounded-full"
              onClick={() => requireAuth(needsCampaign.length ? runBatch : () => setStep(3))}
            >
              {needsCampaign.length ? "Generate campaigns" : "Continue"}
            </Button>
          )}
          {step === 3 && (
            <Button type="button" className="rounded-full" onClick={() => navigate(`/releases/${releaseId}/launch`)}>
              Done
            </Button>
          )}
        </div>
      </SurfacePanel>
    </div>
  );
}
