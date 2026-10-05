import { db } from '@/api/base44Client';

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Music2, ImageIcon, AudioLines, FileText, Target, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

import { loadArtists, loadReleases } from "@/services/data";
import { aiService } from "@/services/aiService";
import { triggerCampaignAutoVideo } from "@/services/socialService";
import { GENRES, LANGUAGES, CAMPAIGN_GOALS, CAMPAIGN_DURATIONS } from "@/services/constants";
import { getSettings } from "@/services/settings";
import { todayISO, addDaysISO, fmtDate } from "@/services/format";
import ArtworkUpload from "@/components/ArtworkUpload";
import AudioUpload from "@/components/AudioUpload";
import AssetAnalysisPanel from "@/components/video/AssetAnalysisPanel";
import { analyzeCampaignAssets, hooksForVibe, resolvePromoStyleFromVisual, saveAssetSession } from "@/services/assetAnalysis";
import VideoRenderProgress from "@/components/VideoRenderProgress";
import PromoStylePicker from "@/components/video/PromoStylePicker";
import { getPromoStylePreset, normalizePromoStyleChoice, suggestPromoStyleFromProfile } from "@/services/promoStylePresets";
import { linkDraftProjectsToCampaignDays, renderPromoForProject } from "@/services/campaignVideoBridge";
import {
  applyBestPlatformMatch,
  buildGeneratedContentFromPlan,
  ensureDayCopyFields,
  renderModeLabel,
  resolveRenderCount,
} from "@/services/campaignPlanEnrichment";
import { getConnectionStatus, scheduleCampaignDay } from "@/services/socialService";
import PageHeader from "@/components/PageHeader";
import SurfacePanel from "@/components/SurfacePanel";
import { useAuth } from "@/lib/AuthContext";
import { billingFailureToast } from "@/lib/billingErrors";

const STEPS = [
  { key: "song", label: "Song", icon: Music2 },
  { key: "artwork", label: "Artwork", icon: ImageIcon },
  { key: "audio", label: "Audio", icon: AudioLines },
  { key: "lyrics", label: "Lyrics", icon: FileText },
  { key: "goals", label: "Goals", icon: Target },
  { key: "generate", label: "Generate", icon: Wand2 },
];

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [artists, setArtists] = useState([]);
  const [releases, setReleases] = useState([]);
  const [form, setForm] = useState(() => {
    const s = getSettings();
    return {
      artistMode: "existing", artistId: "", newArtistName: "", newArtistGenre: "",
      releaseId: "",
      title: "", genre: "", releaseDate: todayISO(), language: "English", description: "",
      artworkUrl: "", artworkFile: null,
      audioUri: "", audioSignedUrl: "", audioDuration: null, audioName: "", audioFile: null,
      lyrics: "", goals: [], durationDays: s.defaultDuration, startDate: todayISO(),
      assetProfile: null,
      promoStylePreset: "viral-pop",
      promoStyleManuallySet: false,
      renderMode: s.defaultCampaignRenderMode || "all",
      autoSchedule: Boolean(s.defaultAutoSchedule),
    };
  });
  const [analyzingAssets, setAnalyzingAssets] = useState(false);
  const [energyChoice, setEnergyChoice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState("");
  const [renderProgress, setRenderProgress] = useState(null);

  useEffect(() => {
    loadArtists().then(setArtists).catch(() => {});
    loadReleases().then(setReleases).catch(() => setReleases([]));
  }, []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const artwork = form.artworkFile || form.artworkUrl;
    const audio = form.audioFile || form.audioSignedUrl;
    if (!artwork || !audio) return undefined;
    let cancelled = false;
    setAnalyzingAssets(true);
    analyzeCampaignAssets({
      artwork,
      audio,
      title: form.title,
      energy: energyChoice,
    }).then((profile) => {
      if (cancelled || !profile) return;
      saveAssetSession(profile);
      setForm((current) => ({ ...current, assetProfile: profile }));
    }).finally(() => {
      if (!cancelled) setAnalyzingAssets(false);
    });
    return () => {
      cancelled = true;
    };
  }, [form.artworkFile, form.artworkUrl, form.audioFile, form.audioSignedUrl, form.title, energyChoice]);

  useEffect(() => {
    if (form.promoStyleManuallySet || !form.assetProfile?.promoStylePreset) return;
    setForm((current) => ({
      ...current,
      promoStylePreset: current.assetProfile.promoStylePreset,
    }));
  }, [form.assetProfile, form.promoStyleManuallySet]);

  const chooseEnergy = (energy) => {
    setEnergyChoice(energy);
    setForm((current) => {
      if (!current.assetProfile) return current;
      const { promoStylePreset, promoStyleReason } = resolvePromoStyleFromVisual(
        {
          theme: current.assetProfile.theme,
          label: current.assetProfile.label,
          promoStylePreset: current.assetProfile.promoStylePreset,
        },
        energy
      );
      const profile = {
        ...current.assetProfile,
        energy,
        promoStylePreset,
        promoStyleReason,
        hooks: hooksForVibe({ energy, title: current.title }),
        keywords: [
          current.assetProfile.theme,
          energy === "fast" ? "Fast / Aggressive" : "Slow / Acoustic",
          current.assetProfile.label,
          current.assetProfile.palette,
        ].filter(Boolean),
      };
      saveAssetSession(profile);
      return {
        ...current,
        assetProfile: profile,
        ...(!current.promoStyleManuallySet ? { promoStylePreset } : {}),
      };
    });
  };

  const selectArtist = (v) => {
    if (v === "__new__") {
      setForm((f) => ({ ...f, artistMode: "new", artistId: "", releaseId: "" }));
      return;
    }
    setForm((f) => {
      const releaseStillValid = !f.releaseId || releases.find((r) => r.id === f.releaseId)?.artist_id === v;
      return {
        ...f,
        artistMode: "existing",
        artistId: v,
        releaseId: releaseStillValid ? f.releaseId : "",
      };
    });
  };

  const selectRelease = (v) => {
    if (v === "__none__") {
      set("releaseId", "");
      return;
    }
    const release = releases.find((r) => r.id === v);
    setForm((f) => ({
      ...f,
      releaseId: v,
      artistMode: "existing",
      artistId: release?.artist_id || f.artistId,
    }));
  };

  const canContinue = () => {
    if (step === 0) {
      if (form.artistMode === "new") return form.newArtistName.trim() && form.title.trim();
      return form.artistId && form.title.trim();
    }
    return true;
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const toggleGoal = (g) => setForm((f) => ({ ...f, goals: f.goals.includes(g) ? f.goals.filter((x) => x !== g) : [...f.goals, g] }));

  const generate = async () => {
    setGenerating(true);
    setRenderProgress(null);
    try {
      setStage("Preparing artist…");
      let artistId = form.artistId;
      if (form.artistMode === "new") {
        const a = await db.entities.Artist.create({ name: form.newArtistName.trim(), genre: form.newArtistGenre, is_demo: false });
        artistId = a.id;
      }
      const artist = artists.find((a) => a.id === artistId) || { name: form.newArtistName, genre: form.newArtistGenre };

      setStage("Saving song…");
      const songPayload = {
        artist_id: artistId, title: form.title.trim(), genre: form.genre, release_date: form.releaseDate,
        language: form.language, description: form.description, artwork_url: form.artworkUrl,
        audio_url: form.audioUri, audio_duration: form.audioDuration, lyrics: form.lyrics,
        analysis: form.assetProfile ? { assetProfile: form.assetProfile } : null, is_demo: false,
      };
      if (form.releaseId) songPayload.release_id = form.releaseId;
      const song = await db.entities.Song.create(songPayload);

      const songForAI = {
        ...song,
        language: form.language,
        artistName: artist.name,
      };

      setStage("Analyzing song with AI…");
      const generated = await aiService.analyzeSong(songForAI);
      const analysis = {
        ...(generated && typeof generated === "object" ? generated : {}),
        assetProfile: form.assetProfile || null,
      };
      await db.entities.Song.update(song.id, { analysis });

      setStage("Generating campaign with AI…");
      const promoStyle = normalizePromoStyleChoice(form.promoStylePreset);
      const result = await aiService.generateCampaign({
        song: songForAI,
        analysis,
        goals: form.goals,
        durationDays: form.durationDays,
        startDate: form.startDate,
        promoStyle,
      });

      setStage("Matching platforms & polishing copy…");
      let connectionStatus = null;
      try {
        connectionStatus = await getConnectionStatus();
      } catch {
        connectionStatus = null;
      }
      const connectedProviders = (connectionStatus?.connections || [])
        .filter((c) => c.status === "connected" && c.canPublish !== false)
        .map((c) => c.provider);

      const enrichedDays = applyBestPlatformMatch(
        ensureDayCopyFields(result.days || [], { song: songForAI, analysis }),
        {
          analysis,
          goals: form.goals,
          connectedProviders,
        }
      );

      setStage("Building day-by-day schedule…");
      const endDate = addDaysISO(form.startDate, form.durationDays - 1);
      const campaignPayload = {
        song_id: song.id, artist_id: artistId, name: result.campaignName || `${form.title} Campaign`,
        status: form.startDate <= todayISO() ? "active" : "scheduled",
        duration_days: form.durationDays, goals: form.goals, start_date: form.startDate, end_date: endDate,
        summary: result.summary, is_demo: false,
      };
      if (form.releaseId) campaignPayload.release_id = form.releaseId;
      const campaign = await db.entities.Campaign.create(campaignPayload);
      const days = enrichedDays.map((d) => ({
        campaign_id: campaign.id, day_number: d.dayNumber, date: d.date, platform: d.platform,
        content_type: d.contentType, objective: d.objective, video_concept: d.videoConcept,
        hook: d.hook, video_template: d.videoTemplate,
        caption: d.caption, hashtags: d.hashtags, cta: d.cta, posting_time: d.postingTime, status: "planned",
        user_id: user?.id || "",
      }));
      let dayProjects = [];
      if (days.length) {
        const createdDays = await db.entities.CampaignDay.bulkCreate(days);
        const me = user || (await db.auth.me().catch(() => null));
        const ownerId = me?.id || "";
        setStage("Creating video drafts for each plan day…");
        dayProjects = await linkDraftProjectsToCampaignDays(db, createdDays, enrichedDays, {
          campaignId: campaign.id,
          songId: song.id,
          song: { ...song, analysis },
          artistName: artist.name || form.newArtistName || "",
          userId: ownerId,
          styleDefaults: promoStyle,
          lyrics: form.lyrics,
        });

        setStage("Saving hooks, captions & CTAs to your library…");
        const contentRows = buildGeneratedContentFromPlan(campaign.id, enrichedDays);
        if (contentRows.length) {
          await db.entities.GeneratedContent.bulkCreate(contentRows);
        }
      }

      let renderedCount = 0;
      let scheduledCount = 0;
      let scheduleSkipped = 0;
      const canRender = form.artworkUrl && (form.audioFile || form.audioSignedUrl || form.audioUri);
      const renderCount = resolveRenderCount(form.renderMode, dayProjects.length);

      if (canRender && renderCount > 0) {
        try {
          for (let i = 0; i < renderCount; i++) {
            const { project, aiDay, dayId } = dayProjects[i];
            const dayLabel = aiDay?.dayNumber || i + 1;
            setStage(`Rendering Day ${dayLabel} promo on your device…`);
            setRenderProgress({ progress: 0, message: `Day ${dayLabel} — starting…` });
            await renderPromoForProject({
              db,
              project,
              songTitle: form.title.trim(),
              artistName: artist.name || form.newArtistName || "",
              artworkUrl: form.artworkUrl,
              artworkFile: form.artworkFile,
              audioUri: form.audioUri,
              audioSignedUrl: form.audioSignedUrl,
              audioFile: form.audioFile,
              audioDuration: form.audioDuration,
              lyrics: form.lyrics,
              linkCampaignId: i === 0 ? campaign.id : "",
              triggerCampaignAutoVideo: i === 0 ? triggerCampaignAutoVideo : null,
              onProgress: (info) => {
                const slice = renderCount > 1 ? (i / renderCount) + info.progress / 100 / renderCount : info.progress / 100;
                setRenderProgress({
                  progress: Math.round(slice * 100),
                  message: info.message || `Day ${dayLabel}…`,
                });
                setStage(info.message || `Rendering Day ${dayLabel}…`);
              },
            });
            renderedCount += 1;

            if (form.autoSchedule && dayId) {
              setStage(`Scheduling Day ${dayLabel} for auto-publish…`);
              const res = await scheduleCampaignDay({ campaignDayId: dayId });
              if (res?.ok) scheduledCount += 1;
              else scheduleSkipped += 1;
            }
          }
          setRenderProgress({ progress: 100, message: "Done" });
        } catch (err) {
          console.warn("[CreateCampaign] Remotion video render", err?.message || err);
          toast({
            variant: "destructive",
            title: "Video render skipped",
            description: err?.message || "Campaign was created with video drafts; open the Videos tab to render later.",
          });
        }
      } else if (form.autoSchedule && dayProjects.length) {
        setStage("Scheduling plan days for auto-publish…");
        for (const { dayId, aiDay } of dayProjects) {
          if (!dayId) continue;
          const res = await scheduleCampaignDay({ campaignDayId: dayId });
          if (res?.ok) scheduledCount += 1;
          else scheduleSkipped += 1;
        }
      }

      const scheduleNote =
        form.autoSchedule && dayProjects.length
          ? scheduledCount
            ? ` ${scheduledCount} day(s) queued for auto-publish.`
            : scheduleSkipped
              ? " Connect TikTok, Instagram, or YouTube in Social to auto-schedule."
              : ""
          : "";

      toast({
        title: "Campaign generated!",
        description:
          renderedCount > 0
            ? `Rendered ${renderedCount} promo video${renderedCount === 1 ? "" : "s"} on this device.${scheduleNote}`
            : dayProjects.length
              ? `Plan, hooks, and video drafts are ready.${scheduleNote || " Add artwork & audio to render promos."}`
              : form.artworkUrl && form.audioUri
                ? `Campaign ready.${scheduleNote}`
                : scheduleNote || undefined,
      });
      const releaseId = campaign.release_id || form.releaseId;
      navigate(releaseId ? `/releases/${releaseId}/launch` : `/campaigns/${campaign.id}/plan`);
    } catch (e) {
      setGenerating(false);
      setStage("");
      setRenderProgress(null);
      const fail = billingFailureToast(e);
      toast({ variant: "destructive", title: fail.title, description: fail.description });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Studio"
        title="New campaign"
        description="Upload assets, set goals, and generate your day-by-day plan."
        actions={
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate("/campaigns")}>
            Cancel
          </Button>
        }
      />

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <div key={s.key} className="flex flex-1 items-center gap-1">
              <div className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-500 transition ${active ? "bg-primary/15 text-primary" : done ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                <span className={`grid h-6 w-6 place-items-center rounded-full ${active ? "bg-primary text-primary-foreground" : done ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border/50" />}
            </div>
          );
        })}
      </div>

      <SurfacePanel>
        {generating ? (
          <GeneratingScreen stage={stage} renderProgress={renderProgress} />
        ) : (
          <>
            {step === 0 && (
              <StepSong
                form={form}
                set={set}
                artists={artists}
                releases={releases}
                selectArtist={selectArtist}
                selectRelease={selectRelease}
              />
            )}
            {step === 1 && <StepArtwork form={form} setForm={setForm} analyzingAssets={analyzingAssets} onEnergy={chooseEnergy} />}
            {step === 2 && <StepAudio form={form} setForm={setForm} analyzingAssets={analyzingAssets} onEnergy={chooseEnergy} />}
            {step === 3 && <StepLyrics form={form} set={set} />}
            {step === 4 && (
              <StepGoals
                form={form}
                set={set}
                toggleGoal={toggleGoal}
                setForm={setForm}
                styleSuggestion={suggestPromoStyleFromProfile(form.assetProfile)}
              />
            )}
            {step === 5 && (
              <>
                <div className="mb-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm">
                  <p className="font-600">Suggested rollout</p>
                  <p className="mt-1 text-muted-foreground">
                    {form.durationDays || 14}-day plan with emphasis on{" "}
                    {(form.platforms || ["TikTok", "Instagram"]).slice(0, 2).join(" and ") || "your platforms"}. After
                    generate, open the release command center to manage each day from one timeline.
                  </p>
                </div>
                <StepSummary form={form} artists={artists} releases={releases} />
              </>
            )}

            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" onClick={back} disabled={step === 0} className="rounded-full"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={next} disabled={!canContinue()} className="rounded-full">Continue <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
              ) : (
                <Button onClick={() => requireAuth(generate)} className="rounded-full"><Sparkles className="mr-1.5 h-4 w-4" />Generate Campaign</Button>
              )}
            </div>
          </>
        )}
      </SurfacePanel>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label className="text-xs font-500 text-muted-foreground">{label}</Label>{children}</div>;
}

function StepSong({ form, set, artists, releases, selectArtist, selectRelease }) {
  const artistReleases = form.artistMode === "existing" && form.artistId
    ? releases.filter((r) => r.artist_id === form.artistId)
    : releases;

  return (
    <div className="space-y-4">
      <Field label="Artist">
        <Select value={form.artistMode === "new" ? "__new__" : form.artistId} onValueChange={selectArtist}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select an artist" /></SelectTrigger>
          <SelectContent>
            {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            <SelectItem value="__new__">＋ Create new artist</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {form.artistMode === "new" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New artist name"><Input value={form.newArtistName} onChange={(e) => set("newArtistName", e.target.value)} placeholder="Artist name" /></Field>
          <Field label="Genre">
            <Select value={form.newArtistGenre} onValueChange={(v) => set("newArtistGenre", v)}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select genre" /></SelectTrigger>
              <SelectContent>{GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      )}
      {form.artistMode === "existing" && (
        <Field label="Release (optional)">
          <Select value={form.releaseId || "__none__"} onValueChange={selectRelease}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="No release" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No release</SelectItem>
              {artistReleases.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">Optional. Leave empty to keep the previous Artist → Song → Campaign flow.</p>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Song Title *"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Northern Light" /></Field>
        <Field label="Genre">
          <Select value={form.genre} onValueChange={(v) => set("genre", v)}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select genre" /></SelectTrigger>
            <SelectContent>{GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Release Date"><Input type="date" value={form.releaseDate} onChange={(e) => set("releaseDate", e.target.value)} /></Field>
        <Field label="Language">
          <p className="mb-1.5 text-xs text-muted-foreground">
            Hooks, captions, hashtags, and CTAs are generated in this language.
          </p>
          <Select value={form.language} onValueChange={(v) => set("language", v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Song Description (optional)"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="What's the song about?" /></Field>
    </div>
  );
}

function StepArtwork({ form, setForm, analyzingAssets, onEnergy }) {
  const { requireAuth } = useAuth();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Upload your album or track artwork. This is used across your campaign and for on-device video rendering.</p>
      <ArtworkUpload
        guard={requireAuth}
        value={form.artworkUrl}
        onChange={(payload) => {
          const url = typeof payload === "string" ? payload : payload?.url || "";
          const file = typeof payload === "object" && payload ? payload.file : null;
          setForm((f) => ({ ...f, artworkUrl: url, artworkFile: file || null }));
        }}
      />
      {form.artworkUrl && form.audioUri ? (
        <AssetAnalysisPanel profile={form.assetProfile} analyzing={analyzingAssets} onEnergy={onEnergy} />
      ) : null}
    </div>
  );
}

function StepAudio({ form, setForm, analyzingAssets, onEnergy }) {
  const { requireAuth } = useAuth();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Upload your song. The audio is stored privately and used for on-device promo video encoding.</p>
      <AudioUpload
        guard={requireAuth}
        value={form.audioUri}
        signedUrl={form.audioSignedUrl}
        onChange={({ file_uri, signed_url, duration, name, file }) => {
          setForm((f) => ({
            ...f,
            audioUri: file_uri || "",
            audioSignedUrl: signed_url || "",
            audioDuration: duration,
            audioName: name || "",
            audioFile: file || null,
          }));
        }}
      />
      {form.artworkUrl && form.audioUri ? (
        <AssetAnalysisPanel profile={form.assetProfile} analyzing={analyzingAssets} onEnergy={onEnergy} />
      ) : (
        <p className="text-xs text-muted-foreground">Add artwork as well, and the cover colors and track energy will be read here.</p>
      )}
    </div>
  );
}

function StepLyrics({ form, set }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Paste your lyrics to help the AI find hooks and themes.</p>
        <Button variant="ghost" size="sm" onClick={() => { set("lyrics", ""); }} className="rounded-full">Skip for now</Button>
      </div>
      <Textarea value={form.lyrics} onChange={(e) => set("lyrics", e.target.value)} rows={10} placeholder="Paste lyrics here…" className="rounded-xl" />
    </div>
  );
}

function StepGoals({ form, set, toggleGoal, setForm, styleSuggestion }) {
  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs font-500 text-muted-foreground">Promo video style</Label>
        {styleSuggestion?.reason ? (
          <p className="mt-1 text-xs text-primary/90">{styleSuggestion.reason}</p>
        ) : null}
        <PromoStylePicker
          className="mt-2"
          value={form.promoStylePreset}
          suggestedId={styleSuggestion?.presetId}
          onChange={(id) => setForm((f) => ({ ...f, promoStylePreset: id, promoStyleManuallySet: true }))}
        />
        <Field label="Promo videos on this device">
          <Select value={form.renderMode} onValueChange={(v) => set("renderMode", v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Render every plan day (recommended)</SelectItem>
              <SelectItem value="first3">Render first 3 days only</SelectItem>
              <SelectItem value="day1">Render day 1 only (fastest)</SelectItem>
              <SelectItem value="skip">Skip — keep video drafts only</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Each day uses its own hook, template, and platform match. Long campaigns take longer to encode.
          </p>
        </Field>
        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.autoSchedule}
            onChange={(e) => set("autoSchedule", e.target.checked)}
          />
          <span>
            <span className="font-500 text-foreground">Auto-schedule posts after generation</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Queues each day on its matched platform at the planned time. Requires a connected TikTok, Instagram, or YouTube account.
            </span>
          </span>
        </label>
      </div>
      <div>
        <Label className="text-xs font-500 text-muted-foreground">Campaign Goals (select one or more)</Label>
        <p className="mb-3 text-xs text-muted-foreground/70">Goals guide the strategy. They are not guarantees of results.</p>
        <div className="flex flex-wrap gap-2">
          {CAMPAIGN_GOALS.map((g) => (
            <button key={g} onClick={() => toggleGoal(g)} className={`rounded-full border px-3.5 py-2 text-sm font-500 transition ${form.goals.includes(g) ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{g}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Campaign length">
          <Select value={String(form.durationDays)} onValueChange={(v) => set("durationDays", Number(v))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{CAMPAIGN_DURATIONS.map((d) => <SelectItem key={d.days} value={String(d.days)}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Campaign start date"><Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
      </div>
    </div>
  );
}

function StepSummary({ form, artists, releases }) {
  const artist = form.artistMode === "new" ? { name: form.newArtistName, genre: form.newArtistGenre } : artists.find((a) => a.id === form.artistId);
  const release = form.releaseId ? releases.find((r) => r.id === form.releaseId) : null;
  const rows = [
    ["Artist", artist?.name || "—"],
    ["Release", release?.title || "None"],
    ["Song", form.title],
    ["Genre", form.genre || artist?.genre || "—"],
    ["Release date", fmtDate(form.releaseDate)],
    ["Language", form.language],
    ["Artwork", form.artworkUrl ? "Uploaded" : "Not uploaded"],
    ["Audio", form.audioUri ? "Uploaded" : "Not uploaded"],
    ["Lyrics", form.lyrics ? `${form.lyrics.split("\n").length} lines` : "Skipped"],
    ["Visual read", form.assetProfile?.label || "Waiting for artwork and audio"],
    ["Energy", form.assetProfile ? (form.assetProfile.energy === "fast" ? "Fast / Aggressive" : "Slow / Acoustic") : "—"],
    ["Promo style", getPromoStylePreset(form.promoStylePreset).label],
    ["Goals", form.goals.length ? form.goals.join(", ") : "None selected"],
    ["Duration", `${form.durationDays} days`],
    ["Video encode", renderModeLabel(form.renderMode)],
    ["Auto-schedule", form.autoSchedule ? "On" : "Off"],
    ["Start", fmtDate(form.startDate)],
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Review your campaign details, then generate. Promo video encodes on your device.</p>
      {form.artworkUrl && <img src={form.artworkUrl} alt="Artwork" className="h-32 w-32 rounded-2xl object-cover" />}
      <div className="divide-y divide-border/40">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-2.5">
            <span className="text-sm text-muted-foreground">{k}</span>
            <span className="text-sm font-500 text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneratingScreen({ stage, renderProgress }) {
  if (renderProgress) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <VideoRenderProgress
          progress={renderProgress.progress}
          message={renderProgress.message || stage}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        <div className="grid h-20 w-20 place-items-center rounded-3xl" style={{ background: "linear-gradient(135deg, hsl(265 90% 68%), hsl(326 85% 62%))" }}>
          <Wand2 className="h-9 w-9 text-white animate-pulse" />
        </div>
      </div>
      <h3 className="font-heading text-xl font-semibold">Generating your campaign</h3>
      <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {stage || "Working…"}
      </p>
      <p className="mt-4 max-w-sm text-xs text-muted-foreground/70">
        AI writes hooks, captions, CTAs, and platform picks for each day, then encodes promos on this device — keep the tab open while rendering.
      </p>
    </div>
  );
}
