import { db } from '@/api/base44Client';

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Download, Play, Pause, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

import { loadCampaign } from "@/services/data";
import { VIDEO_TEMPLATES, getTemplate } from "@/services/videoTemplates";
import { videoService } from "@/services/videoService";
import { TEXT_STYLES, ANIMATION_STYLES } from "@/services/constants";
import { getSettings } from "@/services/settings";
import VideoPreview from "@/components/VideoPreview";

export default function VideoGenerator() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const dayId = params.get("day");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [song, setSong] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [project, setProject] = useState(null);
  const [playing, setPlaying] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);

  useEffect(() => {
    (async () => {
      const s = getSettings();
      const data = await loadCampaign(id);
      setSong(data.song);
      setCampaign(data.campaign);
      let base = {
        template: s.defaultTemplate, title: data.song?.title || "", artist_name: data.artist?.name || "",
        text: "", artwork_url: data.song?.artwork_url || "", audio_url: data.song?.audio_url || "",
        lyrics: data.song?.lyrics || "", text_style: "bold", animation_style: "zoom-pan",
        waveform: false, duration: s.defaultVideoDuration, song_id: data.song?.id, campaign_id: id,
      };
      if (projectId) {
        const p = await db.entities.VideoProject.get(projectId);
        base = { ...base, ...p };
      } else if (dayId) {
        const day = await db.entities.CampaignDay.get(dayId);
        base = { ...base, text: day?.caption || day?.cta || "", title: data.song?.title || "", template: guessTemplate(day?.content_type) };
      } else if (params.get("template")) {
        base = {
          ...base,
          template: params.get("template") || base.template,
          title: params.get("title") ? decodeURIComponent(params.get("title")) : base.title,
          text: params.get("text") ? decodeURIComponent(params.get("text")) : base.text,
          duration: Number(params.get("duration")) || base.duration,
        };
      }
      setProject(base);
    })();
  }, [id]);

  const set = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  const tpl = project ? getTemplate(project.template) : null;

  const save = async () => {
    setSaving(true);
    try {
      if (projectId) {
        await db.entities.VideoProject.update(projectId, project);
      } else {
        const created = await db.entities.VideoProject.create({ ...project, is_demo: false });
        navigate(`/campaigns/${id}/video?project=${created.id}`, { replace: true });
      }
      toast({ title: "Video project saved" });
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const exportVideo = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const res = await videoService.exportVideo(project);
      setExportResult(res);
      toast({ title: "Export prepared (mock)" });
    } catch (e) {
      toast({ variant: "destructive", title: "Export failed", description: e.message });
    } finally {
      setExporting(false);
    }
  };

  if (!project || !tpl) return <div className="h-64 animate-shimmer rounded-2xl" />;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(`/campaigns/${id}`)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to campaign
      </button>
      <h1 className="font-heading text-2xl font-700 tracking-tight">Video Generator</h1>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Preview */}
        <div className="space-y-3">
          <VideoPreview project={project} playing={playing} />
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPlaying((p) => !p)} className="rounded-full">
              {playing ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}{playing ? "Pause" : "Play"}
            </Button>
            <span className="text-xs text-muted-foreground">{project.duration}s · 1080×1920 · 9:16</span>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-yellow-500/80" />
            <span>Live preview is a real in-browser mock of the composition. MP4 export requires an FFmpeg renderer (e.g. on Replit) — not yet connected.</span>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-5 rounded-2xl border border-border/60 card-gradient p-5">
          <div>
            <Label className="text-xs text-muted-foreground">Template</Label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {VIDEO_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => set("template", t.id)} className={`rounded-xl border p-3 text-left transition ${project.template === t.id ? "border-primary/50 bg-primary/10" : "border-border hover:border-primary/30"}`}>
                  <p className="text-sm font-600">{t.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title"><Input value={project.title} onChange={(e) => set("title", e.target.value)} className="rounded-xl" /></Field>
            <Field label="Artist Name"><Input value={project.artist_name} onChange={(e) => set("artist_name", e.target.value)} className="rounded-xl" /></Field>
          </div>

          <Field label="Body Text / Hook"><Textarea value={project.text} onChange={(e) => set("text", e.target.value)} rows={3} className="rounded-xl" /></Field>

          {tpl.id === "LYRICS" && (
            <Field label="Lyrics"><Textarea value={project.lyrics} onChange={(e) => set("lyrics", e.target.value)} rows={4} className="rounded-xl" /></Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Text Style">
              <Select value={project.text_style} onValueChange={(v) => set("text_style", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{TEXT_STYLES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Animation Style">
              <Select value={project.animation_style} onValueChange={(v) => set("animation_style", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{ANIMATION_STYLES.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          {tpl.supportsWaveform && (
            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
              <span className="text-sm">Show audio waveform</span>
              <Switch checked={project.waveform} onCheckedChange={(c) => set("waveform", c)} />
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between"><Label className="text-xs text-muted-foreground">Duration</Label><span className="text-xs text-muted-foreground">{project.duration}s</span></div>
            <Slider value={[project.duration]} min={5} max={30} step={1} onValueChange={(v) => set("duration", v[0])} />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={save} disabled={saving} className="rounded-full"><Save className="mr-1.5 h-4 w-4" />{saving ? "Saving…" : "Save Project"}</Button>
            <Button onClick={exportVideo} disabled={exporting} variant="outline" className="rounded-full"><Download className="mr-1.5 h-4 w-4" />{exporting ? "Exporting…" : "Export Video"}</Button>
          </div>

          {exporting && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Rendering preview…</div>}
          {exportResult && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="font-600 text-foreground">Export (mock)</p>
              <p className="mt-1">{exportResult.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label className="text-xs font-500 text-muted-foreground">{label}</Label>{children}</div>;
}

function guessTemplate(contentType = "") {
  const c = contentType.toLowerCase();
  if (c.includes("lyric")) return "LYRICS";
  if (c.includes("teaser") || c.includes("cinematic")) return "CINEMATIC";
  if (c.includes("waveform")) return "WAVEFORM";
  if (c.includes("release") || c.includes("announcement")) return "RELEASE";
  if (c.includes("hook")) return "HOOK";
  return "MINIMAL";
}
