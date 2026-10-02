import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, AudioLines, Check, FileText, ImageIcon, Music2, Sparkles, Target, Wand2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { db } from '@/api/base44Client';
import ArtworkUpload from '@/components/ArtworkUpload';
import AudioUpload from '@/components/AudioUpload';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Icon } from '@/components/ui/icon';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import AssetAnalysisPanel from '@/components/video/AssetAnalysisPanel';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { aiService } from '@/services/aiService';
import { analyzeCampaignAssets, hooksForVibe, saveAssetSession } from '@/services/assetAnalysis';
import { CAMPAIGN_DURATIONS, CAMPAIGN_GOALS, GENRES, LANGUAGES } from '@/services/constants';
import { loadArtists, loadReleases } from '@/services/data';
import { addDaysISO, fmtDate, todayISO } from '@/services/format';
import { getSettings } from '@/services/settings';

const STEPS = [
  { key: 'song', label: 'Song', icon: Music2 },
  { key: 'artwork', label: 'Artwork', icon: ImageIcon },
  { key: 'audio', label: 'Audio', icon: AudioLines },
  { key: 'lyrics', label: 'Lyrics', icon: FileText },
  { key: 'goals', label: 'Goals', icon: Target },
  { key: 'generate', label: 'Generate', icon: Wand2 },
];

export default function CreateCampaign() {
  const router = useRouter();
  const { user, requireAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [artists, setArtists] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);
  const [form, setForm] = useState<any>(() => ({
    artistMode: 'existing', artistId: '', newArtistName: '', newArtistGenre: '',
    releaseId: '',
    title: '', genre: '', releaseDate: todayISO(), language: 'English', description: '',
    artworkUrl: '', artworkFile: null,
    audioUri: '', audioSignedUrl: '', audioDuration: null, audioName: '', audioFile: null,
    lyrics: '', goals: [], durationDays: 7, startDate: todayISO(),
    assetProfile: null,
  }));
  const [analyzingAssets, setAnalyzingAssets] = useState(false);
  const [energyChoice, setEnergyChoice] = useState('');
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState('');

  useEffect(() => {
    loadArtists().then(setArtists).catch(() => {});
    loadReleases().then(setReleases).catch(() => setReleases([]));
    getSettings().then((s: any) => {
      if (s?.defaultDuration) setForm((f: any) => ({ ...f, durationDays: s.defaultDuration }));
    });
  }, []);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    const artwork = form.artworkFile || form.artworkUrl;
    const audio = form.audioSignedUrl || form.audioFile;
    if (!artwork || !audio) return undefined;
    let cancelled = false;
    setAnalyzingAssets(true);
    analyzeCampaignAssets({
      artwork,
      audio,
      title: form.title,
      energy: energyChoice,
    })
      .then((profile: any) => {
        if (cancelled || !profile) return;
        saveAssetSession(profile);
        setForm((current: any) => ({ ...current, assetProfile: profile }));
      })
      .finally(() => {
        if (!cancelled) setAnalyzingAssets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.artworkFile, form.artworkUrl, form.audioFile, form.audioSignedUrl, form.title, energyChoice]);

  const chooseEnergy = (energy: string) => {
    setEnergyChoice(energy);
    setForm((current: any) => {
      if (!current.assetProfile) return current;
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
      setForm((f: any) => ({ ...f, artistMode: 'new', artistId: '', releaseId: '' }));
      return;
    }
    setForm((f: any) => {
      const releaseStillValid = !f.releaseId || releases.find((r) => r.id === f.releaseId)?.artist_id === v;
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
    setForm((f: any) => ({
      ...f,
      releaseId: v,
      artistMode: 'existing',
      artistId: release?.artist_id || f.artistId,
    }));
  };

  const canContinue = () => {
    if (step === 0) {
      if (form.artistMode === 'new') return !!(form.newArtistName.trim() && form.title.trim());
      return !!(form.artistId && form.title.trim());
    }
    return true;
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const toggleGoal = (g: string) =>
    setForm((f: any) => ({ ...f, goals: f.goals.includes(g) ? f.goals.filter((x: string) => x !== g) : [...f.goals, g] }));

  const generate = async () => {
    setGenerating(true);
    try {
      setStage('Preparing artist…');
      let artistId = form.artistId;
      if (form.artistMode === 'new') {
        const a = await db.entities.Artist.create({ name: form.newArtistName.trim(), genre: form.newArtistGenre, is_demo: false });
        artistId = a.id;
      }
      const artist = artists.find((a) => a.id === artistId) || { name: form.newArtistName, genre: form.newArtistGenre };

      setStage('Saving song…');
      const songPayload: any = {
        artist_id: artistId, title: form.title.trim(), genre: form.genre, release_date: form.releaseDate,
        language: form.language, description: form.description, artwork_url: form.artworkUrl,
        audio_url: form.audioUri, audio_duration: form.audioDuration, lyrics: form.lyrics,
        analysis: form.assetProfile ? { assetProfile: form.assetProfile } : null, is_demo: false,
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
      const result = await aiService.generateCampaign({
        song: songForAI, analysis, goals: form.goals, durationDays: form.durationDays, startDate: form.startDate,
      });

      setStage('Building day-by-day schedule…');
      const endDate = addDaysISO(form.startDate, form.durationDays - 1);
      const campaignPayload: any = {
        song_id: song.id, artist_id: artistId, name: result.campaignName || `${form.title} Campaign`,
        status: form.startDate <= (todayISO() as string) ? 'active' : 'scheduled',
        duration_days: form.durationDays, goals: form.goals, start_date: form.startDate, end_date: endDate,
        summary: result.summary, is_demo: false,
      };
      if (form.releaseId) campaignPayload.release_id = form.releaseId;
      const campaign = await db.entities.Campaign.create(campaignPayload);
      const days = (result.days || []).map((d: any) => ({
        campaign_id: campaign.id, day_number: d.dayNumber, date: d.date, platform: d.platform,
        content_type: d.contentType, objective: d.objective, video_concept: d.videoConcept,
        hook: d.hook, video_template: d.videoTemplate,
        caption: d.caption, hashtags: d.hashtags, cta: d.cta, posting_time: d.postingTime, status: 'planned',
        user_id: user?.id || '',
      }));
      if (days.length) await db.entities.CampaignDay.bulkCreate(days);

      toast({
        title: 'Campaign generated!',
        description: form.artworkUrl && form.audioUri ? 'Campaign ready. You can render the promo video later from the video studio.' : undefined,
      });
      router.replace(`/campaigns/${campaign.id}`);
    } catch (e: any) {
      setGenerating(false);
      setStage('');
      toast({ variant: 'destructive', title: 'Generation failed', description: e.message });
    }
  };

  return (
    <Screen contentClassName="gap-6">
      <View className="flex-row items-center justify-between">
        <Text className="font-heading-bold text-2xl tracking-tight">New Campaign</Text>
        <Pressable onPress={() => router.replace('/campaigns')} hitSlop={10}>
          <Text className="text-sm text-muted-foreground">Cancel</Text>
        </Pressable>
      </View>

      <View>
        <View className="flex-row items-center gap-1">
          {STEPS.map((s, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <View key={s.key} className="flex-1 flex-row items-center gap-1">
                <View className={cn('size-8 items-center justify-center rounded-full', active ? 'bg-primary' : done ? 'bg-primary/30' : 'bg-muted')}>
                  {done ? (
                    <Icon as={Check} size={14} className="text-primary" />
                  ) : (
                    <Icon as={s.icon} size={14} className={active ? 'text-primary-foreground' : 'text-muted-foreground'} />
                  )}
                </View>
                {i < STEPS.length - 1 ? <View className="h-px flex-1 bg-border/50" /> : null}
              </View>
            );
          })}
        </View>
        <Text className="mt-2 text-xs font-medium text-primary">
          Step {step + 1} of {STEPS.length} · {STEPS[step].label}
        </Text>
      </View>

      <View className="rounded-2xl border border-border/60 bg-card p-5">
        {generating ? (
          <GeneratingScreen stage={stage} />
        ) : (
          <>
            {step === 0 && <StepSong form={form} set={set} artists={artists} releases={releases} selectArtist={selectArtist} selectRelease={selectRelease} />}
            {step === 1 && <StepArtwork form={form} setForm={setForm} analyzingAssets={analyzingAssets} onEnergy={chooseEnergy} />}
            {step === 2 && <StepAudio form={form} setForm={setForm} analyzingAssets={analyzingAssets} onEnergy={chooseEnergy} />}
            {step === 3 && <StepLyrics form={form} set={set} />}
            {step === 4 && <StepGoals form={form} set={set} toggleGoal={toggleGoal} />}
            {step === 5 && <StepSummary form={form} artists={artists} releases={releases} />}

            <View className="mt-6 flex-row items-center justify-between">
              <Button variant="ghost" onPress={back} disabled={step === 0} className="rounded-full">
                <Icon as={ArrowLeft} size={16} />
                <Text className="text-sm font-medium">Back</Text>
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onPress={next} disabled={!canContinue()} className="rounded-full">
                  <Text className="text-sm font-medium text-primary-foreground">Continue</Text>
                  <Icon as={ArrowRight} size={16} className="text-primary-foreground" />
                </Button>
              ) : (
                <Button onPress={() => requireAuth(generate)} className="rounded-full">
                  <Icon as={Sparkles} size={16} className="text-primary-foreground" />
                  <Text className="text-sm font-medium text-primary-foreground">Generate Campaign</Text>
                </Button>
              )}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </View>
  );
}

function StepSong({ form, set, artists, releases, selectArtist, selectRelease }: any) {
  const artistReleases =
    form.artistMode === 'existing' && form.artistId ? releases.filter((r: any) => r.artist_id === form.artistId) : releases;

  return (
    <View className="gap-4">
      <Field label="Artist">
        <Select
          value={form.artistMode === 'new' ? '__new__' : form.artistId}
          onValueChange={selectArtist}
          placeholder="Select an artist"
          title="Artist"
          className="rounded-xl"
          options={[...artists.map((a: any) => ({ value: a.id, label: a.name })), { value: '__new__', label: '＋ Create new artist' }]}
        />
      </Field>
      {form.artistMode === 'new' && (
        <>
          <Field label="New artist name">
            <Input value={form.newArtistName} onChangeText={(v) => set('newArtistName', v)} placeholder="Artist name" />
          </Field>
          <Field label="Genre">
            <Select value={form.newArtistGenre} onValueChange={(v) => set('newArtistGenre', v)} placeholder="Select genre" title="Genre" className="rounded-xl" options={GENRES} />
          </Field>
        </>
      )}
      {form.artistMode === 'existing' && (
        <Field label="Release (optional)">
          <Select
            value={form.releaseId || '__none__'}
            onValueChange={selectRelease}
            placeholder="No release"
            title="Release"
            className="rounded-xl"
            options={[{ value: '__none__', label: 'No release' }, ...artistReleases.map((r: any) => ({ value: r.id, label: r.title }))]}
          />
          <Text className="mt-1 text-xs text-muted-foreground">Optional. Leave empty to keep the previous Artist → Song → Campaign flow.</Text>
        </Field>
      )}
      <Field label="Song Title *">
        <Input value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Northern Light" />
      </Field>
      <Field label="Genre">
        <Select value={form.genre} onValueChange={(v) => set('genre', v)} placeholder="Select genre" title="Genre" className="rounded-xl" options={GENRES} />
      </Field>
      <Field label="Release Date">
        <DateField value={form.releaseDate} onChange={(v) => set('releaseDate', v)} />
      </Field>
      <Field label="Language">
        <Select value={form.language} onValueChange={(v) => set('language', v)} title="Language" className="rounded-xl" options={LANGUAGES} />
      </Field>
      <Field label="Song Description (optional)">
        <Textarea value={form.description} onChangeText={(v) => set('description', v)} numberOfLines={3} placeholder="What's the song about?" />
      </Field>
    </View>
  );
}

function StepArtwork({ form, setForm, analyzingAssets, onEnergy }: any) {
  const { requireAuth } = useAuth();
  return (
    <View className="gap-3">
      <Text className="text-sm text-muted-foreground">Upload your album or track artwork. This is used across your campaign and for promo video rendering.</Text>
      <ArtworkUpload
        guard={requireAuth}
        value={form.artworkUrl}
        onChange={(payload: any) => {
          const url = typeof payload === 'string' ? payload : payload?.url || '';
          const file = typeof payload === 'object' && payload ? payload.file : null;
          setForm((f: any) => ({ ...f, artworkUrl: url, artworkFile: file || null }));
        }}
      />
      {form.artworkUrl && form.audioUri ? <AssetAnalysisPanel profile={form.assetProfile} analyzing={analyzingAssets} onEnergy={onEnergy} /> : null}
    </View>
  );
}

function StepAudio({ form, setForm, analyzingAssets, onEnergy }: any) {
  const { requireAuth } = useAuth();
  return (
    <View className="gap-3">
      <Text className="text-sm text-muted-foreground">Upload your song. The audio is stored privately and used for promo video encoding.</Text>
      <AudioUpload
        guard={requireAuth}
        value={form.audioUri}
        signedUrl={form.audioSignedUrl}
        onChange={({ file_uri, signed_url, duration, name, file }: any) => {
          setForm((f: any) => ({
            ...f,
            audioUri: file_uri || '',
            audioSignedUrl: signed_url || '',
            audioDuration: duration,
            audioName: name || '',
            audioFile: file || null,
          }));
        }}
      />
      {form.artworkUrl && form.audioUri ? (
        <AssetAnalysisPanel profile={form.assetProfile} analyzing={analyzingAssets} onEnergy={onEnergy} />
      ) : (
        <Text className="text-xs text-muted-foreground">Add artwork as well, and the cover colors and track energy will be read here.</Text>
      )}
    </View>
  );
}

function StepLyrics({ form, set }: any) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-sm text-muted-foreground">Paste your lyrics to help the AI find hooks and themes.</Text>
        <Button variant="ghost" size="sm" onPress={() => set('lyrics', '')} className="rounded-full">
          Skip for now
        </Button>
      </View>
      <Textarea value={form.lyrics} onChangeText={(v) => set('lyrics', v)} numberOfLines={10} placeholder="Paste lyrics here…" className="min-h-56 rounded-xl" />
    </View>
  );
}

function StepGoals({ form, set, toggleGoal }: any) {
  return (
    <View className="gap-5">
      <View>
        <Label className="text-xs font-medium text-muted-foreground">Campaign Goals (select one or more)</Label>
        <Text className="mb-3 text-xs text-muted-foreground/70">Goals guide the strategy. They are not guarantees of results.</Text>
        <View className="flex-row flex-wrap gap-2">
          {CAMPAIGN_GOALS.map((g: string) => {
            const on = form.goals.includes(g);
            return (
              <Pressable key={g} onPress={() => toggleGoal(g)} className={cn('rounded-full border px-3.5 py-2', on ? 'border-primary/40 bg-primary/15' : 'border-border')}>
                <Text className={cn('text-sm font-medium', on ? 'text-primary' : 'text-muted-foreground')}>{g}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Field label="Campaign length">
        <Select
          value={String(form.durationDays)}
          onValueChange={(v) => set('durationDays', Number(v))}
          title="Campaign length"
          className="rounded-xl"
          options={CAMPAIGN_DURATIONS.map((d: any) => ({ value: String(d.days), label: d.label }))}
        />
      </Field>
      <Field label="Campaign start date">
        <DateField value={form.startDate} onChange={(v) => set('startDate', v)} />
      </Field>
    </View>
  );
}

function StepSummary({ form, artists, releases }: any) {
  const artist = form.artistMode === 'new' ? { name: form.newArtistName, genre: form.newArtistGenre } : artists.find((a: any) => a.id === form.artistId);
  const release = form.releaseId ? releases.find((r: any) => r.id === form.releaseId) : null;
  const rows = [
    ['Artist', artist?.name || '—'],
    ['Release', release?.title || 'None'],
    ['Song', form.title],
    ['Genre', form.genre || artist?.genre || '—'],
    ['Release date', fmtDate(form.releaseDate)],
    ['Language', form.language],
    ['Artwork', form.artworkUrl ? 'Uploaded' : 'Not uploaded'],
    ['Audio', form.audioUri ? 'Uploaded' : 'Not uploaded'],
    ['Lyrics', form.lyrics ? `${form.lyrics.split('\n').length} lines` : 'Skipped'],
    ['Visual read', form.assetProfile?.label || 'Waiting for artwork and audio'],
    ['Energy', form.assetProfile ? (form.assetProfile.energy === 'fast' ? 'Fast / Aggressive' : 'Slow / Acoustic') : '—'],
    ['Goals', form.goals.length ? form.goals.join(', ') : 'None selected'],
    ['Duration', `${form.durationDays} days`],
    ['Start', fmtDate(form.startDate)],
  ];
  return (
    <View className="gap-4">
      <Text className="text-sm text-muted-foreground">Review your campaign details, then generate.</Text>
      {form.artworkUrl ? <Image source={{ uri: form.artworkUrl }} style={{ width: 128, height: 128, borderRadius: 16 }} contentFit="cover" /> : null}
      <View>
        {rows.map(([k, v], i) => (
          <View key={k} className={cn('flex-row items-center justify-between gap-3 py-2.5', i > 0 && 'border-t border-border/40')}>
            <Text className="text-sm text-muted-foreground">{k}</Text>
            <Text className="flex-1 text-right text-sm font-medium">{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function GeneratingScreen({ stage }: { stage: string }) {
  return (
    <View className="items-center py-12">
      <View className="mb-6 size-20 items-center justify-center rounded-3xl bg-primary">
        <Icon as={Wand2} size={36} color="#ffffff" />
      </View>
      <Text className="text-center font-heading-bold text-xl">Generating your campaign</Text>
      <View className="mt-1.5 flex-row items-center gap-2">
        <ActivityIndicator size="small" />
        <Text className="text-sm text-muted-foreground">{stage || 'Working…'}</Text>
      </View>
      <Text className="mt-4 max-w-xs text-center text-xs text-muted-foreground/70">
        This usually takes 10–30 seconds. The AI analyzes your song and builds a day-by-day plan.
      </Text>
    </View>
  );
}
