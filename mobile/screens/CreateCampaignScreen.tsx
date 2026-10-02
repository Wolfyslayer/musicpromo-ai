import { db } from '@/api/db';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import {
  Check,
  Loader2,
  Sparkles,
  Music2,
  ImageIcon,
  AudioLines,
  FileText,
  Target,
  Wand2,
} from 'lucide-react-native';
import ArtworkUpload from '@/components/ArtworkUpload';
import AudioUpload from '@/components/AudioUpload';
import AssetAnalysisPanel from '@/components/video/AssetAnalysisPanel';
import { ArtworkImage } from '@/components/ArtworkImage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/toast';
import { analyzeCampaignAssets, hooksForVibe, saveAssetSession } from '@/services/assetAnalysis';
import { aiService } from '@/services/aiService';
import {
  CAMPAIGN_DURATIONS,
  CAMPAIGN_GOALS,
  GENRES,
  LANGUAGES,
} from '@/services/constants';
import { loadArtists, loadReleases } from '@/services/data';
import { addDaysISO, fmtDate, todayISO } from '@/services/format';
import { getSettings } from '@/services/settings';
import { triggerCampaignAutoVideo } from '@/services/socialService';
import { buildLyricCues } from '@/lib/promoStyles';
import { videoService } from '@/services/videoService';

const STEPS = [
  { key: 'song', label: 'Song', icon: Music2 },
  { key: 'artwork', label: 'Artwork', icon: ImageIcon },
  { key: 'audio', label: 'Audio', icon: AudioLines },
  { key: 'lyrics', label: 'Lyrics', icon: FileText },
  { key: 'goals', label: 'Goals', icon: Target },
  { key: 'generate', label: 'Generate', icon: Wand2 },
];

type FormState = {
  artistMode: 'existing' | 'new';
  artistId: string;
  newArtistName: string;
  newArtistGenre: string;
  releaseId: string;
  title: string;
  genre: string;
  releaseDate: string;
  language: string;
  description: string;
  artworkUrl: string;
  artworkFile: Blob | null;
  audioUri: string;
  audioSignedUrl: string;
  audioDuration: number | null;
  audioName: string;
  audioFile: Blob | null;
  lyrics: string;
  goals: string[];
  durationDays: number;
  startDate: string;
  assetProfile: Record<string, unknown> | null;
};

export default function CreateCampaignScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [artists, setArtists] = useState<Array<{ id: string; name?: string; genre?: string }>>([]);
  const [releases, setReleases] = useState<Array<{ id: string; title?: string; artist_id?: string }>>(
    [],
  );
  const [form, setForm] = useState<FormState | null>(null);
  const [analyzingAssets, setAnalyzingAssets] = useState(false);
  const [energyChoice, setEnergyChoice] = useState('');
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState('');
  const [renderProgress, setRenderProgress] = useState<{ progress: number; message: string } | null>(
    null,
  );

  useEffect(() => {
    Promise.all([getSettings(), loadArtists(), loadReleases()]).then(([settings, a, r]) => {
      setForm({
        artistMode: 'existing',
        artistId: '',
        newArtistName: '',
        newArtistGenre: '',
        releaseId: '',
        title: '',
        genre: '',
        releaseDate: todayISO() || '',
        language: 'English',
        description: '',
        artworkUrl: '',
        artworkFile: null,
        audioUri: '',
        audioSignedUrl: '',
        audioDuration: null,
        audioName: '',
        audioFile: null,
        lyrics: '',
        goals: [],
        durationDays: settings.defaultDuration,
        startDate: todayISO() || '',
        assetProfile: null,
      });
      setArtists(a);
      setReleases(r || []);
    });
  }, []);

  useEffect(() => {
    if (!form) return undefined;
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
    })
      .then((profile) => {
        if (cancelled || !profile) return;
        saveAssetSession(profile);
        setForm((current) => (current ? { ...current, assetProfile: profile } : current));
      })
      .finally(() => {
        if (!cancelled) setAnalyzingAssets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form?.artworkFile, form?.artworkUrl, form?.audioFile, form?.audioSignedUrl, form?.title, energyChoice]);

  if (!form) {
    return <ActivityIndicator className="flex-1 py-24" />;
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const chooseEnergy = (energy: string) => {
    setEnergyChoice(energy);
    setForm((current) => {
      if (!current?.assetProfile) return current;
      const profile = {
        ...current.assetProfile,
        energy,
        hooks: hooksForVibe({ energy, title: current.title }),
        keywords: [
          current.assetProfile.theme,
          energy === 'fast' ? 'Fast / Aggressive' : 'Slow / Acoustic',
          current.assetProfile.label,
          current.assetProfile.palette,
        ].filter(Boolean),
      };
      saveAssetSession(profile);
      return { ...current, assetProfile: profile };
    });
  };

  const selectArtist = (v: string) => {
    if (v === '__new__') {
      setForm((f) => (f ? { ...f, artistMode: 'new', artistId: '', releaseId: '' } : f));
      return;
    }
    setForm((f) => {
      if (!f) return f;
      const releaseStillValid =
        !f.releaseId || releases.find((r) => r.id === f.releaseId)?.artist_id === v;
      return {
        ...f,
        artistMode: 'existing',
        artistId: v,
        releaseId: releaseStillValid ? f.releaseId : '',
      };
    });
  };

  const selectRelease = (v: string) => {
    if (v === '__none__') {
      set('releaseId', '');
      return;
    }
    const release = releases.find((r) => r.id === v);
    setForm((f) =>
      f
        ? {
            ...f,
            releaseId: v,
            artistMode: 'existing',
            artistId: release?.artist_id || f.artistId,
          }
        : f,
    );
  };

  const canContinue = () => {
    if (step === 0) {
      if (form.artistMode === 'new') return form.newArtistName.trim() && form.title.trim();
      return form.artistId && form.title.trim();
    }
    return true;
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const toggleGoal = (g: string) =>
    setForm((f) =>
      f
        ? {
            ...f,
            goals: f.goals.includes(g) ? f.goals.filter((x) => x !== g) : [...f.goals, g],
          }
        : f,
    );

  const generate = async () => {
    setGenerating(true);
    setRenderProgress(null);
    try {
      setStage('Preparing artist…');
      let artistId = form.artistId;
      if (form.artistMode === 'new') {
        const a = await db.entities.Artist.create({
          name: form.newArtistName.trim(),
          genre: form.newArtistGenre,
          is_demo: false,
        });
        artistId = a.id;
      }
      const artist =
        artists.find((a) => a.id === artistId) || {
          name: form.newArtistName,
          genre: form.newArtistGenre,
        };

      setStage('Saving song…');
      const songPayload: Record<string, unknown> = {
        artist_id: artistId,
        title: form.title.trim(),
        genre: form.genre,
        release_date: form.releaseDate,
        language: form.language,
        description: form.description,
        artwork_url: form.artworkUrl,
        audio_url: form.audioUri,
        audio_duration: form.audioDuration,
        lyrics: form.lyrics,
        analysis: form.assetProfile ? { assetProfile: form.assetProfile } : null,
        is_demo: false,
      };
      if (form.releaseId) songPayload.release_id = form.releaseId;
      const song = await db.entities.Song.create(songPayload);
      const songForAI = { ...song, artistName: artist.name };

      setStage('Analyzing song with AI…');
      const generated = await aiService.analyzeSong(songForAI);
      const analysis = {
        ...(generated && typeof generated === 'object' ? generated : {}),
        assetProfile: form.assetProfile || null,
      };
      await db.entities.Song.update(song.id, { analysis });

      setStage('Generating campaign with AI…');
      const result = (await aiService.generateCampaign({
        song: songForAI,
        analysis,
        goals: form.goals,
        durationDays: form.durationDays,
        startDate: form.startDate,
      })) as {
        campaignName?: string;
        summary?: string;
        days?: Array<{
          dayNumber: number;
          date: string;
          platform: string;
          contentType: string;
          objective: string;
          videoConcept: string;
          hook: string;
          videoTemplate: string;
          caption: string;
          hashtags: string[];
          cta: string;
          postingTime: string;
        }>;
      };

      setStage('Building day-by-day schedule…');
      const endDate = addDaysISO(form.startDate, form.durationDays - 1);
      const today = todayISO() || '';
      const campaignPayload: Record<string, unknown> = {
        song_id: song.id,
        artist_id: artistId,
        name: result.campaignName || `${form.title} Campaign`,
        status: form.startDate <= today ? 'active' : 'scheduled',
        duration_days: form.durationDays,
        goals: form.goals,
        start_date: form.startDate,
        end_date: endDate,
        summary: result.summary,
        is_demo: false,
      };
      if (form.releaseId) campaignPayload.release_id = form.releaseId;
      const campaign = await db.entities.Campaign.create(campaignPayload);
      const days = (result.days || []).map(
        (d: {
          dayNumber: number;
          date: string;
          platform: string;
          contentType: string;
          objective: string;
          videoConcept: string;
          hook: string;
          videoTemplate: string;
          caption: string;
          hashtags: string[];
          cta: string;
          postingTime: string;
        }) => ({
          campaign_id: campaign.id,
          day_number: d.dayNumber,
          date: d.date,
          platform: d.platform,
          content_type: d.contentType,
          objective: d.objective,
          video_concept: d.videoConcept,
          hook: d.hook,
          video_template: d.videoTemplate,
          caption: d.caption,
          hashtags: d.hashtags,
          cta: d.cta,
          posting_time: d.postingTime,
          status: 'planned',
          user_id: user?.id || '',
        }),
      );
      if (days.length) await db.entities.CampaignDay.bulkCreate(days);

      let renderedVideoUrl = '';
      if (form.artworkUrl && (form.audioFile || form.audioSignedUrl || form.audioUri)) {
        setStage('Rendering promo video…');
        setRenderProgress({ progress: 0, message: 'Starting…' });
        try {
          const firstDay = (result.days || [])[0];
          const hooks = (form.assetProfile?.hooks as string[] | undefined) || [];
          const duration = Math.min(15, Math.max(8, Number(form.audioDuration) || 12));
          const lyricCues = buildLyricCues(form.lyrics || '', duration, []);
          const project = {
            template: 'LYRICS',
            title: form.title.trim(),
            artist_name: artist.name || form.newArtistName || '',
            text:
              firstDay?.hook ||
              hooks[0] ||
              firstDay?.caption ||
              form.description ||
              '',
            artwork_url: form.artworkUrl,
            audio_url: form.audioUri,
            lyrics: form.lyrics || '',
            visual_style: 'pop',
            particle_effect: 'none',
            lyric_cues: lyricCues,
            duration,
            video_type: 'promo',
            campaign_id: campaign.id,
            song_id: song.id,
            user_id: user?.id || '',
          };

          const res = await videoService.exportVideo(project, {
            audioUrl: form.audioSignedUrl || undefined,
            artworkFile: form.artworkFile || undefined,
            audioFile: form.audioFile || undefined,
            onProgress: (info: { progress?: number; message?: string }) => {
              setRenderProgress({
                progress: info.progress ?? 0,
                message: info.message || 'Rendering…',
              });
              setStage(info.message || 'Rendering promo video…');
            },
          });

          if (res?.status === 'needs_web_render') {
            toast({
              title: 'Video render skipped',
              description:
                res.message ||
                'Campaign was created. Open Studio on web or upload an MP4 later.',
            });
          } else if (res?.status === 'ready' && res.downloadUrl) {
            renderedVideoUrl = res.downloadUrl;
            setStage('Saving video project…');
            await db.entities.VideoProject.create({
              campaign_id: campaign.id,
              song_id: song.id,
              template: 'LYRICS',
              title: form.title.trim(),
              artist_name: artist.name || form.newArtistName || '',
              text: firstDay?.hook || firstDay?.caption || '',
              artwork_url: form.artworkUrl,
              audio_url: form.audioUri,
              lyrics: String(form.lyrics || '').slice(0, 2000),
              visual_style: 'pop',
              particle_effect: 'none',
              lyric_cues: lyricCues,
              duration: res.project?.duration || duration,
              aspect_ratio: '9:16',
              resolution: '1080x1920',
              output_format: 'mp4',
              rendering_status: 'complete',
              render_output_url: renderedVideoUrl,
              status: 'ready',
              is_demo: false,
              user_id: user?.id || '',
            });
            await triggerCampaignAutoVideo({
              campaignId: campaign.id,
              videoUrl: renderedVideoUrl,
            });
            setRenderProgress({ progress: 100, message: 'Done' });
          } else if (res?.status === 'failed') {
            toast({
              title: 'Video render skipped',
              description: res.message || 'Campaign was created without a promo video.',
            });
          }
        } catch (err) {
          console.warn('[CreateCampaign] video render', err);
          toast({
            title: 'Video render skipped',
            description:
              err instanceof Error
                ? err.message
                : 'Campaign was created, but the promo video could not be rendered.',
          });
        }
      }

      toast({
        title: 'Campaign generated!',
        description: renderedVideoUrl
          ? 'Promo video rendered and uploaded.'
          : form.artworkUrl && form.audioUri
            ? 'Campaign ready. You can render the promo video later in Studio.'
            : undefined,
      });
      setGenerating(false);
      router.replace(`/campaigns/${campaign.id}`);
    } catch (e) {
      setGenerating(false);
      setStage('');
      setRenderProgress(null);
      toast({
        title: 'Generation failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  };

  const artistReleases =
    form.artistMode === 'existing' && form.artistId
      ? releases.filter((r) => r.artist_id === form.artistId)
      : releases;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-4 pb-12">
      <View className="flex-row items-center justify-between">
        <Text className="font-heading text-2xl font-bold text-foreground">New Campaign</Text>
        <Pressable onPress={() => router.push('/campaigns')}>
          <Text className="text-sm text-muted-foreground">Cancel</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <View key={s.key} className="mr-2 flex-row items-center">
              <View
                className={`flex-row items-center gap-2 rounded-full px-2 py-1 ${
                  active ? 'bg-primary/15' : 'bg-transparent'
                }`}
              >
                <View
                  className={`h-6 w-6 items-center justify-center rounded-full ${
                    active ? 'bg-primary' : done ? 'bg-primary/30' : 'bg-muted'
                  }`}
                >
                  {done ? (
                    <Check color="#8b5cf6" size={14} />
                  ) : (
                    <Icon color={active ? '#fff' : '#64748b'} size={14} />
                  )}
                </View>
                <Text className={`text-xs ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                  {s.label}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View className="rounded-2xl border border-border bg-card p-5">
        {generating ? (
          <View className="items-center py-12">
            {renderProgress ? (
              <>
                <Text className="text-sm font-semibold text-foreground">{renderProgress.message}</Text>
                <View className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <View
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, renderProgress.progress)}%` }}
                  />
                </View>
              </>
            ) : (
              <>
                <Wand2 color="#8b5cf6" size={36} />
                <Text className="mt-4 text-lg font-bold text-foreground">Generating your campaign</Text>
                <View className="mt-2 flex-row items-center gap-2">
                  <Loader2 color="#64748b" size={16} />
                  <Text className="text-sm text-muted-foreground">{stage || 'Working…'}</Text>
                </View>
              </>
            )}
          </View>
        ) : (
          <>
            {step === 0 && (
              <View className="gap-4">
                <View className="gap-1.5">
                  <Label>Artist</Label>
                  <Select
                    value={form.artistMode === 'new' ? '__new__' : form.artistId}
                    onValueChange={selectArtist}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an artist" />
                    </SelectTrigger>
                    <SelectContent>
                      {artists.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">＋ Create new artist</SelectItem>
                    </SelectContent>
                  </Select>
                </View>
                {form.artistMode === 'new' && (
                  <>
                    <Input
                      label="New artist name"
                      value={form.newArtistName}
                      onChangeText={(v) => set('newArtistName', v)}
                    />
                    <View className="gap-1.5">
                      <Label>Genre</Label>
                      <Select value={form.newArtistGenre} onValueChange={(v) => set('newArtistGenre', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select genre" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENRES.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </View>
                  </>
                )}
                {form.artistMode === 'existing' && (
                  <View className="gap-1.5">
                    <Label>Release (optional)</Label>
                    <Select value={form.releaseId || '__none__'} onValueChange={selectRelease}>
                      <SelectTrigger>
                        <SelectValue placeholder="No release" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No release</SelectItem>
                        {artistReleases.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </View>
                )}
                <Input label="Song Title *" value={form.title} onChangeText={(v) => set('title', v)} />
                <View className="gap-1.5">
                  <Label>Genre</Label>
                  <Select value={form.genre} onValueChange={(v) => set('genre', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </View>
                <Input
                  label="Release Date"
                  value={form.releaseDate}
                  onChangeText={(v) => set('releaseDate', v)}
                  placeholder="YYYY-MM-DD"
                />
                <View className="gap-1.5">
                  <Label>Language</Label>
                  <Select value={form.language} onValueChange={(v) => set('language', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </View>
                <Textarea
                  label="Song Description (optional)"
                  value={form.description}
                  onChangeText={(v) => set('description', v)}
                  numberOfLines={3}
                />
              </View>
            )}

            {step === 1 && (
              <View className="gap-3">
                <Text className="text-sm text-muted-foreground">
                  Upload album or track artwork for your campaign and videos.
                </Text>
                <ArtworkUpload
                  guard={requireAuth}
                  value={form.artworkUrl}
                  onChange={(payload) => {
                    const url = typeof payload === 'string' ? payload : payload?.url || '';
                    const file =
                      typeof payload === 'object' && payload ? (payload.file as Blob | null) : null;
                    setForm((f) => (f ? { ...f, artworkUrl: url, artworkFile: file } : f));
                  }}
                />
                {form.artworkUrl && form.audioUri ? (
                  <AssetAnalysisPanel
                    profile={form.assetProfile}
                    analyzing={analyzingAssets}
                    onEnergy={chooseEnergy}
                  />
                ) : null}
              </View>
            )}

            {step === 2 && (
              <View className="gap-3">
                <Text className="text-sm text-muted-foreground">
                  Upload your song. Audio is stored for promo video encoding.
                </Text>
                <AudioUpload
                  guard={requireAuth}
                  value={form.audioUri}
                  signedUrl={form.audioSignedUrl}
                  onChange={({ file_uri, signed_url, duration, name, file }) => {
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            audioUri: file_uri || '',
                            audioSignedUrl: signed_url || '',
                            audioDuration: duration,
                            audioName: name || '',
                            audioFile: file || null,
                          }
                        : f,
                    );
                  }}
                />
                {form.artworkUrl && form.audioUri ? (
                  <AssetAnalysisPanel
                    profile={form.assetProfile}
                    analyzing={analyzingAssets}
                    onEnergy={chooseEnergy}
                  />
                ) : (
                  <Text className="text-xs text-muted-foreground">
                    Add artwork as well to read cover colors and track energy.
                  </Text>
                )}
              </View>
            )}

            {step === 3 && (
              <View className="gap-3">
                <Text className="text-sm text-muted-foreground">
                  Paste lyrics to help the AI find hooks and themes.
                </Text>
                <Button variant="ghost" label="Skip for now" onPress={() => set('lyrics', '')} />
                <Textarea value={form.lyrics} onChangeText={(v) => set('lyrics', v)} numberOfLines={10} />
              </View>
            )}

            {step === 4 && (
              <View className="gap-5">
                <Text className="text-xs text-muted-foreground">Campaign Goals (select one or more)</Text>
                <View className="flex-row flex-wrap gap-2">
                  {CAMPAIGN_GOALS.map((g) => (
                    <Pressable
                      key={g}
                      onPress={() => toggleGoal(g)}
                      className={`rounded-full border px-3 py-2 ${
                        form.goals.includes(g) ? 'border-primary/40 bg-primary/15' : 'border-border'
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          form.goals.includes(g) ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {g}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View className="gap-1.5">
                  <Label>Campaign length</Label>
                  <Select
                    value={String(form.durationDays)}
                    onValueChange={(v) => set('durationDays', Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_DURATIONS.map((d) => (
                        <SelectItem key={d.days} value={String(d.days)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </View>
                <Input
                  label="Campaign start date"
                  value={form.startDate}
                  onChangeText={(v) => set('startDate', v)}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            )}

            {step === 5 && (
              <View className="gap-4">
                <Text className="text-sm text-muted-foreground">
                  Review your campaign details, then generate.
                </Text>
                {form.artworkUrl ? (
                  <ArtworkImage src={form.artworkUrl} className="h-32 w-32" rounded="rounded-2xl" />
                ) : null}
                {[
                  ['Artist', form.artistMode === 'new' ? form.newArtistName : artists.find((a) => a.id === form.artistId)?.name],
                  ['Song', form.title],
                  ['Artwork', form.artworkUrl ? 'Uploaded' : 'Not uploaded'],
                  ['Audio', form.audioUri ? 'Uploaded' : 'Not uploaded'],
                  ['Duration', `${form.durationDays} days`],
                  ['Start', fmtDate(form.startDate)],
                ].map(([k, v]) => (
                  <View key={String(k)} className="flex-row justify-between py-2">
                    <Text className="text-sm text-muted-foreground">{k}</Text>
                    <Text className="text-sm font-medium text-foreground">{v || '—'}</Text>
                  </View>
                ))}
              </View>
            )}

            <View className="mt-6 flex-row items-center justify-between">
              <Button variant="ghost" label="Back" onPress={back} disabled={step === 0} />
              {step < STEPS.length - 1 ? (
                <Button label="Continue" onPress={next} disabled={!canContinue()} />
              ) : (
                <Button
                  label="Generate Campaign"
                  onPress={() => {
                    if (!requireAuth(generate)) router.push('/login');
                  }}
                />
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
