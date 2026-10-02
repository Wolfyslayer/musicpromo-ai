// @ts-nocheck
import { View, Text, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '@/api/db';

import { useState } from "react";
import { Zap, MessageSquare, Hash, MousePointerClick, Film, Loader2, Plus } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';

import { aiService } from "@/services/aiService";
import { PLATFORMS } from "@/services/constants";
import { useToast } from '@/lib/toast';
import ContentItem from "@/components/campaign/ContentItem";
import CreateVideoButton from '@/components/video/CreateVideoButton';

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

  return (
    <View className="space-y-5">
      <View className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <View className="text-sm text-muted-foreground">AI-generated content for this campaign. Everything is editable and persists after refresh.</View>
        <View className="flex items-center gap-2">
          <View className="text-xs text-muted-foreground">Platform</View>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-8 w-40 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </View>
      </View>

      <Section icon={Zap} title="Hooks" count={hooks.length} onGenerate={genHooks} loading={loading === "hook"}>
        {hooks.map((item) => (
          <ContentItem key={item.id} item={item} onEdit={(it, t) => updateRecord(it, { content: t })} onDelete={deleteRecord} onRegenerate={regenerate}>
            <View className="text-sm font-600">{item.content}</View>
            <View className="mt-1 text-xs text-muted-foreground">{item.metadata?.videoConcept} · {item.metadata?.reason}</View>
          </ContentItem>
        ))}
      </Section>

      <Section icon={MessageSquare} title="Captions" count={captions.length} onGenerate={genCaptions} loading={loading === "caption"}>
        {captions.map((item) => (
          <ContentItem key={item.id} item={item} onEdit={(it, t) => updateRecord(it, { content: t })} onDelete={deleteRecord} onRegenerate={regenerate}>
            <View className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wider text-primary">{item.metadata?.variation}</View>
            <View className="mt-1 text-sm">{item.content}</View>
          </ContentItem>
        ))}
      </Section>

      <Section icon={Hash} title="Hashtags" count={hashtags.length} onGenerate={genHashtags} loading={loading === "hashtags"}>
        {hashtags.map((item) => (
          <ContentItem key={item.id} item={item} onEdit={(it, t) => updateRecord(it, { content: t, metadata: { ...it.metadata, tags: t.split(/\s+/) } })} onDelete={deleteRecord} onRegenerate={regenerate}>
            <View className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground">{item.metadata?.category}</View>
            <View className="mt-0.5 text-xs font-mono text-primary">{item.content}</View>
          </ContentItem>
        ))}
      </Section>

      <Section icon={MousePointerClick} title="Calls to Action" count={ctas.length} onGenerate={genCTAs} loading={loading === "cta"}>
        {ctas.map((item) => (
          <ContentItem key={item.id} item={item} onEdit={(it, t) => updateRecord(it, { content: t })} onDelete={deleteRecord} onRegenerate={regenerate}>
            <View className="text-sm">{item.content}</View>
            {item.metadata?.goal && <View className="mt-0.5 text-xs text-muted-foreground">Goal: {item.metadata.goal}</View>}
          </ContentItem>
        ))}
      </Section>

      <Section icon={Film} title="Video Concepts" count={concepts.length} onGenerate={genConcepts} loading={loading === "video_concept"}>
        {concepts.map((item) => (
          <ContentItem key={item.id} item={item} onEdit={(it, t) => updateRecord(it, { content: t })} onDelete={deleteRecord} onRegenerate={regenerate}
            extraActions={
              <CreateVideoButton
                campaignId={campaign.id}
               
                className="h-7 rounded-full px-2 text-xs"
                query={{
                  template: item.metadata?.template || "HOOK",
                  title: item.metadata?.title || "",
                  text: item.metadata?.hookText || "",
                }}
              >
                <Film />Create Video
              </CreateVideoButton>
            }
          >
            <View className="flex items-center gap-2">
              <View className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wider text-accent">{item.metadata?.template}</View>
              <View className="text-sm font-600">{item.metadata?.title}</View>
            </View>
            <View className="mt-1 text-xs text-muted-foreground">{item.content}</View>
            <View className="mt-1 text-xs text-primary">Hook: {item.metadata?.hookText} · {item.metadata?.duration}s</View>
          </ContentItem>
        ))}
      </Section>
    </View>
  );
}

function Section({ icon: Icon, title, count, onGenerate, loading, children }) {
  return (
    <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <View className="mb-3 flex items-center justify-between">
        <View className="flex items-center gap-2 text-sm font-600"><Icon className="h-4 w-4 text-primary" />{title} {count > 0 && <View className="text-xs text-muted-foreground">({count})</View>}</View>
        <Button variant="outline" onPress={onGenerate} disabled={loading} className="rounded-full">
          {loading ? <Loader2 /> : <Plus />}
          {loading ? "Generating…" : "Generate"}
        </Button>
      </View>
      {count === 0 && !loading ? (
        <View className="text-sm text-muted-foreground">No {title.toLowerCase()} yet. Click Generate to create some.</View>
      ) : (
        <View className="space-y-2">{children}</View>
      )}
    </View>
  );
}
