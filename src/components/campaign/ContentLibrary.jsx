import { db } from '@/api/base44Client';

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, MessageSquare, Hash, MousePointerClick, Film, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { aiService } from "@/services/aiService";
import { PLATFORMS } from "@/services/constants";
import { useToast } from "@/components/ui/use-toast";
import ContentItem from "@/components/campaign/ContentItem";

/**
 * Content Library — organises all AI-generated content for a campaign into
 * Hooks, Captions, Hashtags, CTAs and Video Concepts. Each item is persisted
 * (GeneratedContent entity), editable, deletable and regenerable individually.
 *
 * Real functionality: AI generation via aiService, persistence via database.
 * No duplicates: records are only created on Generate/Regenerate, never on open.
 */
export default function ContentLibrary({ campaign, song, content = [], onRefresh }) {
  const [platform, setPlatform] = useState("TikTok");
  const [loading, setLoading] = useState(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const analysis = song?.analysis;
  const songData = { ...song, artistName: song?.artistName };
  const goals = campaign?.goals || [];

  const createRecords = async (records) => {
    if (!records.length) return;
    await db.entities.GeneratedContent.bulkCreate(records);
    onRefresh();
  };
  const updateRecord = async (item, patch) => {
    await db.entities.GeneratedContent.update(item.id, patch);
    onRefresh();
  };
  const deleteRecord = async (item) => {
    await db.entities.GeneratedContent.delete(item.id);
    onRefresh();
  };

  const genHooks = async () => {
    setLoading("hook");
    try {
      const res = await aiService.generateHooks({ song: songData, analysis, platform });
      await createRecords((res.hooks || []).map((h) => ({
        campaign_id: campaign.id, type: "hook", platform: h.platform || platform,
        content: h.text, metadata: { videoConcept: h.videoConcept, reason: h.reason, platform: h.platform },
      })));
      toast({ title: `${(res.hooks || []).length} hooks generated` });
    } catch (e) { toast({ variant: "destructive", title: "Failed", description: e.message }); }
    finally { setLoading(null); }
  };

  const genCaptions = async () => {
    setLoading("caption");
    try {
      const res = await aiService.generateCaptions({ song: songData, analysis, platform });
      await createRecords((res.captions || []).map((c) => ({
        campaign_id: campaign.id, type: "caption", platform,
        content: c.text, metadata: { variation: c.variation },
      })));
      toast({ title: "3 captions generated" });
    } catch (e) { toast({ variant: "destructive", title: "Failed", description: e.message }); }
    finally { setLoading(null); }
  };

  const genHashtags = async () => {
    setLoading("hashtags");
    try {
      const res = await aiService.generateHashtags({ song: songData, analysis, platform });
      await createRecords((res.categories || []).map((c) => ({
        campaign_id: campaign.id, type: "hashtags", platform,
        content: (c.tags || []).join(" "), metadata: { category: c.category, tags: c.tags },
      })));
      toast({ title: "Hashtags generated" });
    } catch (e) { toast({ variant: "destructive", title: "Failed", description: e.message }); }
    finally { setLoading(null); }
  };

  const genCTAs = async () => {
    setLoading("cta");
    try {
      const res = await aiService.generateCTA({ song: songData, analysis, campaignGoals: goals });
      await createRecords((res.ctas || []).map((c) => ({
        campaign_id: campaign.id, type: "cta", content: c.text, metadata: { goal: c.goal },
      })));
      toast({ title: "CTAs generated" });
    } catch (e) { toast({ variant: "destructive", title: "Failed", description: e.message }); }
    finally { setLoading(null); }
  };

  const genConcepts = async () => {
    setLoading("video_concept");
    try {
      const res = await aiService.generateVideoConcepts({ song: songData, analysis });
      await createRecords((res.concepts || []).map((c) => ({
        campaign_id: campaign.id, type: "video_concept",
        content: c.description, metadata: { title: c.title, conceptType: c.conceptType, template: c.template, hookText: c.hookText, duration: c.duration },
      })));
      toast({ title: `${(res.concepts || []).length} video concepts generated` });
    } catch (e) { toast({ variant: "destructive", title: "Failed", description: e.message }); }
    finally { setLoading(null); }
  };

  const regenerate = async (item) => {
    setLoading(`regen-${item.id}`);
    try {
      let first = null;
      if (item.type === "hook") {
        const res = await aiService.generateHooks({ song: songData, analysis, platform: item.metadata?.platform || platform });
        first = (res.hooks || [])[0];
        if (first) await updateRecord(item, { content: first.text, metadata: { videoConcept: first.videoConcept, reason: first.reason, platform: first.platform } });
      } else if (item.type === "caption") {
        const res = await aiService.generateCaptions({ song: songData, analysis, platform: item.platform || platform });
        first = (res.captions || [])[0];
        if (first) await updateRecord(item, { content: first.text, metadata: { variation: first.variation } });
      } else if (item.type === "hashtags") {
        const res = await aiService.generateHashtags({ song: songData, analysis, platform: item.platform || platform });
        first = (res.categories || [])[0];
        if (first) await updateRecord(item, { content: (first.tags || []).join(" "), metadata: { category: first.category, tags: first.tags } });
      } else if (item.type === "cta") {
        const res = await aiService.generateCTA({ song: songData, analysis, campaignGoals: goals });
        first = (res.ctas || [])[0];
        if (first) await updateRecord(item, { content: first.text, metadata: { goal: first.goal } });
      } else if (item.type === "video_concept") {
        const res = await aiService.generateVideoConcepts({ song: songData, analysis });
        first = (res.concepts || [])[0];
        if (first) await updateRecord(item, { content: first.description, metadata: { title: first.title, conceptType: first.conceptType, template: first.template, hookText: first.hookText, duration: first.duration } });
      }
      toast({ title: "Regenerated" });
    } catch (e) { toast({ variant: "destructive", title: "Failed", description: e.message }); }
    finally { setLoading(null); }
  };

  const hooks = content.filter((c) => c.type === "hook");
  const captions = content.filter((c) => c.type === "caption");
  const hashtags = content.filter((c) => c.type === "hashtags");
  const ctas = content.filter((c) => c.type === "cta");
  const concepts = content.filter((c) => c.type === "video_concept");

  const openVideoFromConcept = (item) => {
    const m = item.metadata || {};
    const q = new URLSearchParams({
      template: m.template || "HOOK",
      title: m.title || "",
      text: m.hookText || "",
      duration: String(m.duration || 10),
    });
    navigate(`/campaigns/${campaign.id}/video?${q.toString()}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">AI-generated content for this campaign. Everything is editable and persists after refresh.</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Platform</span>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-8 w-40 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Section icon={Zap} title="Hooks" count={hooks.length} onGenerate={genHooks} loading={loading === "hook"}>
        {hooks.map((item) => (
          <ContentItem key={item.id} item={item} onEdit={(it, t) => updateRecord(it, { content: t })} onDelete={deleteRecord} onRegenerate={regenerate}>
            <p className="text-sm font-600">{item.content}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.metadata?.videoConcept} · {item.metadata?.reason}</p>
          </ContentItem>
        ))}
      </Section>

      <Section icon={MessageSquare} title="Captions" count={captions.length} onGenerate={genCaptions} loading={loading === "caption"}>
        {captions.map((item) => (
          <ContentItem key={item.id} item={item} onEdit={(it, t) => updateRecord(it, { content: t })} onDelete={deleteRecord} onRegenerate={regenerate}>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wider text-primary">{item.metadata?.variation}</span>
            <p className="mt-1 text-sm">{item.content}</p>
          </ContentItem>
        ))}
      </Section>

      <Section icon={Hash} title="Hashtags" count={hashtags.length} onGenerate={genHashtags} loading={loading === "hashtags"}>
        {hashtags.map((item) => (
          <ContentItem key={item.id} item={item} onEdit={(it, t) => updateRecord(it, { content: t, metadata: { ...it.metadata, tags: t.split(/\s+/) } })} onDelete={deleteRecord} onRegenerate={regenerate}>
            <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground">{item.metadata?.category}</p>
            <p className="mt-0.5 text-xs font-mono text-primary">{item.content}</p>
          </ContentItem>
        ))}
      </Section>

      <Section icon={MousePointerClick} title="Calls to Action" count={ctas.length} onGenerate={genCTAs} loading={loading === "cta"}>
        {ctas.map((item) => (
          <ContentItem key={item.id} item={item} onEdit={(it, t) => updateRecord(it, { content: t })} onDelete={deleteRecord} onRegenerate={regenerate}>
            <p className="text-sm">{item.content}</p>
            {item.metadata?.goal && <p className="mt-0.5 text-xs text-muted-foreground">Goal: {item.metadata.goal}</p>}
          </ContentItem>
        ))}
      </Section>

      <Section icon={Film} title="Video Concepts" count={concepts.length} onGenerate={genConcepts} loading={loading === "video_concept"}>
        {concepts.map((item) => (
          <ContentItem key={item.id} item={item} onEdit={(it, t) => updateRecord(it, { content: t })} onDelete={deleteRecord} onRegenerate={regenerate}
            extraActions={
              <Button size="sm" variant="outline" className="h-7 rounded-full px-2 text-xs" onClick={() => openVideoFromConcept(item)}>
                <Film className="mr-1 h-3 w-3" />Create Video
              </Button>
            }
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wider text-accent">{item.metadata?.template}</span>
              <p className="text-sm font-600">{item.metadata?.title}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.content}</p>
            <p className="mt-1 text-xs text-primary">Hook: {item.metadata?.hookText} · {item.metadata?.duration}s</p>
          </ContentItem>
        ))}
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, count, onGenerate, loading, children }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-600"><Icon className="h-4 w-4 text-primary" />{title} {count > 0 && <span className="text-xs text-muted-foreground">({count})</span>}</h3>
        <Button size="sm" variant="outline" onClick={onGenerate} disabled={loading} className="rounded-full">
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
          {loading ? "Generating…" : "Generate"}
        </Button>
      </div>
      {count === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">No {title.toLowerCase()} yet. Click Generate to create some.</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}
