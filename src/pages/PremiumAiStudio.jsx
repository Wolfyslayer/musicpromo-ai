import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Music2, Split, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { billingFailureToast } from "@/lib/billingErrors";
import { fetchBillingStatus } from "@/services/billingService";
import {
  fetchStemSplitStatus,
  fetchSunoStatus,
  generateSunoTrack,
  splitAudioStems,
} from "@/services/premiumAiService";
import PageHeader from "@/components/PageHeader";

export default function PremiumAiStudio() {
  const { requireAuth } = useAuth();
  const { toast } = useToast();
  const [billing, setBilling] = useState(null);
  const [sunoStatus, setSunoStatus] = useState(null);
  const [stemStatus, setStemStatus] = useState(null);
  const [sunoForm, setSunoForm] = useState({ title: "", prompt: "", lyrics: "" });
  const [sunoUrl, setSunoUrl] = useState("");
  const [sunoBusy, setSunoBusy] = useState(false);
  const [stemUrl, setStemUrl] = useState("");
  const [stemInput, setStemInput] = useState("");
  const [stems, setStems] = useState(null);
  const [stemBusy, setStemBusy] = useState(false);

  useEffect(() => {
    fetchBillingStatus().then(setBilling).catch(() => {});
    fetchSunoStatus().then(setSunoStatus).catch(() => setSunoStatus({ configured: false }));
    fetchStemSplitStatus().then(setStemStatus).catch(() => setStemStatus({ configured: false }));
  }, []);

  const hasSuno = billing?.billingExempt || billing?.premiumFeatures?.suno_generation;
  const hasStem = billing?.billingExempt || billing?.premiumFeatures?.stem_split;

  const runSuno = () =>
    requireAuth(async () => {
      if (!sunoForm.prompt.trim()) {
        toast({ variant: "destructive", title: "Add a prompt", description: "Describe the song you want." });
        return;
      }
      setSunoBusy(true);
      try {
        const data = await generateSunoTrack({
          title: sunoForm.title,
          prompt: sunoForm.prompt,
          lyrics: sunoForm.lyrics,
        });
        setSunoUrl(data.audioUrl || "");
        toast({ title: "Track ready", description: "Download or attach to a release." });
      } catch (e) {
        const fail = billingFailureToast(e);
        toast({ variant: "destructive", title: fail.title, description: fail.description });
      } finally {
        setSunoBusy(false);
      }
    });

  const runStem = () =>
    requireAuth(async () => {
      if (!stemInput.trim()) {
        toast({ variant: "destructive", title: "Audio URL required", description: "Paste a public MP3/WAV link." });
        return;
      }
      setStemBusy(true);
      setStems(null);
      try {
        const data = await splitAudioStems({ audioUrl: stemInput.trim() });
        setStemUrl(stemInput);
        setStems(data.stems || {});
        toast({ title: "Stems ready", description: "Download each stem below." });
      } catch (e) {
        const fail = billingFailureToast(e);
        toast({ variant: "destructive", title: fail.title, description: fail.description });
      } finally {
        setStemBusy(false);
      }
    });

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Premium AI"
        title="Songs & stems"
        description="Creator plan and above — full promo stack plus Suno & stems, priced below most AI-only apps."
        actions={
          !hasSuno || !hasStem ? (
            <Button type="button" className="rounded-full" asChild>
              <Link to="/settings/billing">Upgrade from $9/mo</Link>
            </Button>
          ) : null
        }
      />

      {!hasSuno || !hasStem ? (
        <p className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          Suno generation and stem splitting require an active <strong>Creator</strong>, <strong>Pro</strong>, or{" "}
          <strong>Studio</strong> subscription.{" "}
          <Link to="/settings/billing" className="font-semibold text-primary underline">
            Compare plans
          </Link>
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex items-center gap-2">
          <Music2 className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg font-semibold">AI song (Suno)</h2>
        </div>
        {!sunoStatus?.configured ? (
          <p className="text-sm text-amber-200/90">Backend: set SUNO_API_BASE_URL and SUNO_API_KEY in Supabase secrets.</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Title</Label>
            <Input
              value={sunoForm.title}
              onChange={(e) => setSunoForm((f) => ({ ...f, title: e.target.value }))}
              className="rounded-xl"
              placeholder="Single title"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Prompt</Label>
            <Textarea
              value={sunoForm.prompt}
              onChange={(e) => setSunoForm((f) => ({ ...f, prompt: e.target.value }))}
              rows={4}
              className="rounded-xl"
              placeholder="Upbeat Afro-pop, female vocal, summer festival energy…"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Lyrics (optional)</Label>
            <Textarea
              value={sunoForm.lyrics}
              onChange={(e) => setSunoForm((f) => ({ ...f, lyrics: e.target.value }))}
              rows={5}
              className="rounded-xl font-mono text-sm"
              placeholder="Verse / chorus lyrics…"
            />
          </div>
        </div>
        <Button type="button" className="rounded-full" disabled={sunoBusy || !hasSuno} onClick={runSuno}>
          {sunoBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate song
        </Button>
        {sunoUrl ? (
          <audio controls className="w-full" src={sunoUrl}>
            <track kind="captions" />
          </audio>
        ) : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex items-center gap-2">
          <Split className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg font-semibold">Stem splitter</h2>
        </div>
        {!stemStatus?.configured ? (
          <p className="text-sm text-amber-200/90">Backend: set REPLICATE_API_TOKEN (Demucs model).</p>
        ) : null}
        <div className="space-y-1.5">
          <Label>Public audio URL</Label>
          <Input
            value={stemInput}
            onChange={(e) => setStemInput(e.target.value)}
            className="rounded-xl"
            placeholder="https://…/track.mp3"
          />
        </div>
        <Button type="button" variant="outline" className="rounded-full" disabled={stemBusy || !hasStem} onClick={runStem}>
          {stemBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Split className="mr-2 h-4 w-4" />}
          Split stems
        </Button>
        {stems ? (
          <ul className="space-y-2 text-sm">
            {Object.entries(stems).map(([name, url]) => (
              <li key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
                <span className="font-medium capitalize">{name.replace(/_/g, " ")}</span>
                <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {stemUrl && !stems ? null : null}
      </section>
    </div>
  );
}
