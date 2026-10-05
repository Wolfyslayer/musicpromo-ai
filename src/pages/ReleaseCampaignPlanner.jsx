import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Rocket, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import SurfacePanel from "@/components/SurfacePanel";
import ArtworkImage from "@/components/ArtworkImage";
import ReleasePickOrCreateStep from "@/components/releases/ReleasePickOrCreateStep";
import { loadRelease } from "@/services/data";
import { CAMPAIGN_DURATIONS, CAMPAIGN_GOALS } from "@/services/constants";
import { generateCampaignForAlbum, generateCampaignForSong } from "@/services/createCampaignCore";
import { resolveReleaseCampaignState } from "@/services/releaseCampaignMode";
import { sortReleaseTracks, staggeredStartDate } from "@/services/releaseTracks";
import { todayISO } from "@/services/format";
import { billingFailureToast } from "@/lib/billingErrors";
import { getSettings } from "@/services/settings";

const STEPS_WITH_RELEASE = ["Tracks", "Rollout", "Generate", "Social"];
const STEPS_WITHOUT_RELEASE = ["Release", ...STEPS_WITH_RELEASE];

export default function ReleaseCampaignPlanner() {
  const [searchParams] = useSearchParams();
  const releaseId = searchParams.get("release") || "";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(releaseId));
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState("");
  const [results, setResults] = useState([]);

  const stepLabels = releaseId ? STEPS_WITH_RELEASE : STEPS_WITHOUT_RELEASE;
  const tracksStepIndex = releaseId ? 0 : 1;
  const rolloutStepIndex = tracksStepIndex + 1;
  const generateStepIndex = rolloutStepIndex + 1;
  const socialStepIndex = generateStepIndex + 1;

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
    if (!releaseId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [releaseId]);

  useEffect(() => {
    if (data?.release?.release_date) {
      setRollout((r) => ({ ...r, startDate: data.release.release_date }));
    }
  }, [data?.release?.release_date]);

  const songs = useMemo(() => sortReleaseTracks(data?.songs || []), [data?.songs]);
  const campaigns = data?.campaigns || [];
  const campaignState = useMemo(
    () => resolveReleaseCampaignState(data?.release, songs, campaigns),
    [data?.release, songs, campaigns]
  );
  const { isAlbum, albumCampaign, campaignBySong, needsGeneration, pendingTrackCount, tracksNeedingCampaign } =
    campaignState;

  const toggleGoal = (g) =>
    setRollout((r) => ({
      ...r,
      goals: r.goals.includes(g) ? r.goals.filter((x) => x !== g) : [...r.goals, g],
    }));

  const onReleaseReady = (id) => {
    navigate(`/create?release=${id}`, { replace: true });
    setStep(0);
    setResults([]);
  };

  const runBatch = async () => {
    setGenerating(true);
    setResults([]);
    const out = [];
    try {
      if (isAlbum) {
        setStage(`Album: ${data.release.title}`);
        const { campaign } = await generateCampaignForAlbum({
          release: data.release,
          songs,
          artist: data.artist,
          goals: rollout.goals,
          durationDays: rollout.durationDays,
          startDate: rollout.startDate,
          promoStylePreset: rollout.promoStylePreset,
          userId: user?.id || "",
          onStage: setStage,
        });
        out.push({ campaignId: campaign.id, title: data.release.title });
      } else {
        const queue = tracksNeedingCampaign || [];
        for (let i = 0; i < queue.length; i++) {
          const song = queue[i];
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
      }
      setResults(out);
      toast({
        title: out.length
          ? isAlbum
            ? "Album campaign plan created"
            : `${out.length} campaign plan${out.length === 1 ? "" : "s"} created`
          : isAlbum
            ? "Album already has a campaign"
            : "All tracks already had campaigns",
      });
      await reload();
      setStep(socialStepIndex);
    } catch (e) {
      const fail = billingFailureToast(e);
      toast({ variant: "destructive", title: fail.title, description: fail.description });
    } finally {
      setGenerating(false);
      setStage("");
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => (releaseId ? navigate(`/releases/${releaseId}`) : navigate("/"))}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {releaseId ? "Back to release" : "Back to dashboard"}
      </button>

      <PageHeader
        eyebrow="Release → Campaign → Social"
        title="Plan your campaign"
        description="Same flow for singles, EPs, and albums: choose a release, set rollout, generate plans per track, then publish from Social Hub."
      />

      <div className="flex flex-wrap gap-2">
        {stepLabels.map((label, i) => (
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
        {!releaseId && step === 0 ? <ReleasePickOrCreateStep onReleaseReady={onReleaseReady} /> : null}

        {releaseId && loading ? <div className="h-32 animate-shimmer rounded-2xl" /> : null}

        {releaseId && !loading && !data?.release ? (
          <p className="text-destructive">
            Release not found.{" "}
            <Link to="/releases" className="underline">
              Back to releases
            </Link>
          </p>
        ) : null}

        {releaseId && !loading && data?.release && step === tracksStepIndex ? (
          <TracksStep
            release={data.release}
            artist={data.artist}
            releaseId={releaseId}
            songs={songs}
            isAlbum={isAlbum}
            albumCampaign={albumCampaign}
            campaignBySong={campaignBySong}
            navigate={navigate}
          />
        ) : null}

        {releaseId && data?.release && step === rolloutStepIndex ? (
          <RolloutStep rollout={rollout} setRollout={setRollout} toggleGoal={toggleGoal} isAlbum={isAlbum} />
        ) : null}

        {releaseId && data?.release && step === generateStepIndex ? (
          <GenerateStep
            generating={generating}
            stage={stage}
            isAlbum={isAlbum}
            needsGeneration={needsGeneration}
            pendingTrackCount={pendingTrackCount}
          />
        ) : null}

        {releaseId && data?.release && step === socialStepIndex ? (
          <SocialStep release={data.release} releaseId={releaseId} results={results} navigate={navigate} />
        ) : null}

        {releaseId && data?.release ? (
          <div className="mt-6 flex justify-between">
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              disabled={(step === tracksStepIndex && !releaseId) || generating}
              onClick={() => {
                if (step === tracksStepIndex) {
                  navigate("/create", { replace: true });
                  setStep(0);
                  return;
                }
                setStep((s) => s - 1);
              }}
            >
              Back
            </Button>
            {step < generateStepIndex && (
              <Button
                type="button"
                className="rounded-full"
                disabled={step === tracksStepIndex && !songs.length}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
            {step === generateStepIndex && !generating && (
              <Button
                type="button"
                className="rounded-full"
                onClick={() => requireAuth(needsGeneration ? runBatch : () => setStep(socialStepIndex))}
              >
                {needsGeneration ? (isAlbum ? "Generate album campaign" : "Generate campaigns") : "Continue"}
              </Button>
            )}
            {step === socialStepIndex ? (
              <Button type="button" className="rounded-full" onClick={() => navigate(`/releases/${releaseId}/launch`)}>
                Done
              </Button>
            ) : null}
          </div>
        ) : null}
      </SurfacePanel>
    </div>
  );
}

function TracksStep({ release, artist, releaseId, songs, isAlbum, albumCampaign, campaignBySong, navigate }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <ArtworkImage src={release.artwork_url} alt={release.title} className="h-20 w-20 shrink-0" rounded="rounded-xl" />
        <div>
          <p className="font-heading text-lg font-semibold">{release.title}</p>
          <p className="text-sm text-muted-foreground">
            {artist?.name}
            {release.release_type ? ` · ${release.release_type}` : ""}
          </p>
          {isAlbum ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Albums get <strong className="font-medium text-foreground">one campaign</strong> for the whole release.
              {albumCampaign ? (
                <>
                  {" "}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => navigate(`/campaigns/${albumCampaign.id}/plan`)}
                  >
                    Open album plan
                  </Button>
                </>
              ) : (
                " Generate it in the next steps."
              )}
            </p>
          ) : null}
        </div>
      </div>
      {!songs.length ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Add tracks on the release editor, then return here.
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
                  {isAlbum
                    ? albumCampaign
                      ? "Included in album campaign"
                      : "Included when you generate the album plan"
                    : camp
                      ? "Campaign ready"
                      : "Needs campaign"}
                  {!s.audio_url ? " · add audio in track setup" : ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    if (isAlbum && albumCampaign) {
                      navigate(`/campaigns/${albumCampaign.id}/plan`);
                      return;
                    }
                    if (!isAlbum && camp) {
                      navigate(`/campaigns/${camp.id}/plan`);
                      return;
                    }
                    navigate(`/create/track?release=${releaseId}&song=${s.id}`);
                  }}
                >
                  {isAlbum && albumCampaign ? "Open album plan" : !isAlbum && camp ? "Open plan" : "Full track setup"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RolloutStep({ rollout, setRollout, toggleGoal, isAlbum }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isAlbum
          ? "One album-wide plan: teases, tracklist moments, release day, and post-launch posts in a single timeline."
          : "Shared plan settings for each new campaign. Stagger start dates so singles can drop before the full release day."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{isAlbum ? "Campaign start" : "Campaign start (track 1)"}</Label>
          <Input
            type="date"
            value={rollout.startDate}
            onChange={(e) => setRollout((r) => ({ ...r, startDate: e.target.value }))}
            className="rounded-xl"
          />
        </div>
        {!isAlbum ? (
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
        ) : null}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">{isAlbum ? "Plan length" : "Plan length (per track)"}</Label>
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
  );
}

function GenerateStep({ generating, stage, isAlbum, needsGeneration, pendingTrackCount }) {
  return (
    <div className="space-y-4">
      {generating ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          {stage || "Generating…"}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {isAlbum ? (
              <>
                Creates <strong>one</strong> AI campaign plan for the full album
                {pendingTrackCount ? (
                  <>
                    {" "}
                    ({pendingTrackCount} track{pendingTrackCount === 1 ? "" : "s"} on the release).
                  </>
                ) : null}
              </>
            ) : (
              <>
                Creates AI campaign plans for <strong>{pendingTrackCount}</strong> track
                {pendingTrackCount === 1 ? "" : "s"} without campaigns. Tracks that already have campaigns are skipped.
              </>
            )}
          </p>
          {!needsGeneration ? (
            <p className="text-sm text-primary">
              {isAlbum ? "This album already has a campaign — continue to social setup." : "Every track already has a campaign — continue to social setup."}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function SocialStep({ release, releaseId, results, navigate }) {
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4" />
        Rollout is ready for social publishing.
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
  );
}
