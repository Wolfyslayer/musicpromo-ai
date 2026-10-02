import { useState } from "react";
import { View } from "react-native";
import { Film, Hash, MessageSquare, MousePointerClick, Plus, Zap } from "lucide-react-native";
import { db } from "@/api/db";
import { aiService } from "@/services/aiService";
import { PLATFORMS } from "@/services/constants";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import ContentItem from "@/components/campaign/ContentItem";
import CreateVideoButton from "@/components/video/CreateVideoButton";

const PLATFORM_OPTIONS = PLATFORMS.map((p) => ({ value: p.id, label: p.label }));

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

  const fail = (e) => toast({ variant: "destructive", title: "Failed", description: e.message });

  const genHooks = async () => {
    setLoading("hook");
    try {
      const res = await aiService.generateHooks({ song: songData, analysis, platform });
      await createRecords(
        (res.hooks || []).map((h) => ({
          campaign_id: campaign.id,
          type: "hook",
          platform: h.platform || platform,
          content: h.text,
          metadata: { videoConcept: h.videoConcept, reason: h.reason, platform: h.platform },
        }))
      );
      toast({ title: `${(res.hooks || []).length} hooks generated` });
    } catch (e) {
      fail(e);
    } finally {
      setLoading(null);
    }
  };

  const genCaptions = async () => {
    setLoading("caption");
    try {
      const res = await aiService.generateCaptions({ song: songData, analysis, platform });
      await createRecords(
        (res.captions || []).map((c) => ({
          campaign_id: campaign.id,
          type: "caption",
          platform,
          content: c.text,
          metadata: { variation: c.variation },
        }))
      );
      toast({ title: "3 captions generated" });
    } catch (e) {
      fail(e);
    } finally {
      setLoading(null);
    }
  };

  const genHashtags = async () => {
    setLoading("hashtags");
    try {
      const res = await aiService.generateHashtags({ song: songData, analysis, platform });
      await createRecords(
        (res.categories || []).map((c) => ({
          campaign_id: campaign.id,
          type: "hashtags",
          platform,
          content: (c.tags || []).join(" "),
          metadata: { category: c.category, tags: c.tags },
        }))
      );
      toast({ title: "Hashtags generated" });
    } catch (e) {
      fail(e);
    } finally {
      setLoading(null);
    }
  };

  const genCTAs = async () => {
    setLoading("cta");
    try {
      const res = await aiService.generateCTA({ song: songData, analysis, campaignGoals: goals });
      await createRecords(
        (res.ctas || []).map((c) => ({
          campaign_id: campaign.id,
          type: "cta",
          content: c.text,
          metadata: { goal: c.goal },
        }))
      );
      toast({ title: "CTAs generated" });
    } catch (e) {
      fail(e);
    } finally {
      setLoading(null);
    }
  };

  const genConcepts = async () => {
    setLoading("video_concept");
    try {
      const res = await aiService.generateVideoConcepts({ song: songData, analysis });
      await createRecords(
        (res.concepts || []).map((c) => ({
          campaign_id: campaign.id,
          type: "video_concept",
          content: c.description,
          metadata: { title: c.title, conceptType: c.conceptType, template: c.template, hookText: c.hookText, duration: c.duration },
        }))
      );
      toast({ title: `${(res.concepts || []).length} video concepts generated` });
    } catch (e) {
      fail(e);
    } finally {
      setLoading(null);
    }
  };

  const regenerate = async (item) => {
    setLoading(`regen-${item.id}`);
    try {
      let first = null;
      if (item.type === "hook") {
        const res = await aiService.generateHooks({ song: songData, analysis, platform: item.metadata?.platform || platform });
        first = (res.hooks || [])[0];
        if (first) {
          await updateRecord(item, {
            content: first.text,
            metadata: { videoConcept: first.videoConcept, reason: first.reason, platform: first.platform },
          });
        }
      } else if (item.type === "caption") {
        const res = await aiService.generateCaptions({ song: songData, analysis, platform: item.platform || platform });
        first = (res.captions || [])[0];
        if (first) await updateRecord(item, { content: first.text, metadata: { variation: first.variation } });
      } else if (item.type === "hashtags") {
        const res = await aiService.generateHashtags({ song: songData, analysis, platform: item.platform || platform });
        first = (res.categories || [])[0];
        if (first) {
          await updateRecord(item, {
            content: (first.tags || []).join(" "),
            metadata: { category: first.category, tags: first.tags },
          });
        }
      } else if (item.type === "cta") {
        const res = await aiService.generateCTA({ song: songData, analysis, campaignGoals: goals });
        first = (res.ctas || [])[0];
        if (first) await updateRecord(item, { content: first.text, metadata: { goal: first.goal } });
      } else if (item.type === "video_concept") {
        const res = await aiService.generateVideoConcepts({ song: songData, analysis });
        first = (res.concepts || [])[0];
        if (first) {
          await updateRecord(item, {
            content: first.description,
            metadata: {
              title: first.title,
              conceptType: first.conceptType,
              template: first.template,
              hookText: first.hookText,
              duration: first.duration,
            },
          });
        }
      }
      toast({ title: "Regenerated" });
    } catch (e) {
      fail(e);
    } finally {
      setLoading(null);
    }
  };

  const hooks = content.filter((c) => c.type === "hook");
  const captions = content.filter((c) => c.type === "caption");
  const hashtags = content.filter((c) => c.type === "hashtags");
  const ctas = content.filter((c) => c.type === "cta");
  const concepts = content.filter((c) => c.type === "video_concept");

  const itemProps = (item) => ({
    item,
    onEdit: (it, t) => updateRecord(it, { content: t }),
    onDelete: deleteRecord,
    onRegenerate: regenerate,
  });

  return (
    <View className="gap-5">
      <View className="gap-3">
        <Text className="text-sm text-muted-foreground">
          AI-generated content for this campaign. Everything is editable and persists after refresh.
        </Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted-foreground">Platform</Text>
          <Select
            value={platform}
            onValueChange={setPlatform}
            options={PLATFORM_OPTIONS}
            title="Platform"
            className="h-9 w-48 rounded-xl"
          />
        </View>
      </View>

      <Section icon={Zap} title="Hooks" count={hooks.length} onGenerate={genHooks} loading={loading === "hook"}>
        {hooks.map((item) => {
          return (
            <ContentItem key={item.id} {...itemProps(item)}>
              <Text className="text-sm font-600">{item.content}</Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                {item.metadata?.videoConcept} · {item.metadata?.reason}
              </Text>
            </ContentItem>
          );
        })}
      </Section>

      <Section icon={MessageSquare} title="Captions" count={captions.length} onGenerate={genCaptions} loading={loading === "caption"}>
        {captions.map((item) => {
          return (
            <ContentItem key={item.id} {...itemProps(item)}>
              {item.metadata?.variation ? (
                <View className="self-start rounded-full bg-primary/15 px-2 py-0.5">
                  <Text className="text-[10px] font-600 uppercase tracking-wider text-primary">{item.metadata.variation}</Text>
                </View>
              ) : null}
              <Text className="mt-1 text-sm">{item.content}</Text>
            </ContentItem>
          );
        })}
      </Section>

      <Section icon={Hash} title="Hashtags" count={hashtags.length} onGenerate={genHashtags} loading={loading === "hashtags"}>
        {hashtags.map((item) => {
          return (
            <ContentItem
              key={item.id}
              {...itemProps(item)}
              onEdit={(it, t) => updateRecord(it, { content: t, metadata: { ...it.metadata, tags: t.split(/\s+/) } })}
            >
              <Text className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground">{item.metadata?.category}</Text>
              <Text className="mt-0.5 font-mono text-xs text-primary">{item.content}</Text>
            </ContentItem>
          );
        })}
      </Section>

      <Section icon={MousePointerClick} title="Calls to Action" count={ctas.length} onGenerate={genCTAs} loading={loading === "cta"}>
        {ctas.map((item) => {
          return (
            <ContentItem key={item.id} {...itemProps(item)}>
              <Text className="text-sm">{item.content}</Text>
              {item.metadata?.goal ? <Text className="mt-0.5 text-xs text-muted-foreground">Goal: {item.metadata.goal}</Text> : null}
            </ContentItem>
          );
        })}
      </Section>

      <Section icon={Film} title="Video Concepts" count={concepts.length} onGenerate={genConcepts} loading={loading === "video_concept"}>
        {concepts.map((item) => {
          return (
            <ContentItem
              key={item.id}
              {...itemProps(item)}
              extraActions={
                <CreateVideoButton
                  campaignId={campaign.id}
                  size="sm"
                  icon={Film}
                  className="h-7 rounded-full px-2"
                  query={{
                    template: item.metadata?.template || "HOOK",
                    title: item.metadata?.title || "",
                    text: item.metadata?.hookText || "",
                  }}
                >
                  Create Video
                </CreateVideoButton>
              }
            >
              <View className="flex-row flex-wrap items-center gap-2">
                {item.metadata?.template ? (
                  <View className="rounded-full bg-accent/15 px-2 py-0.5">
                    <Text className="text-[10px] font-600 uppercase tracking-wider text-accent">{item.metadata.template}</Text>
                  </View>
                ) : null}
                <Text className="flex-1 text-sm font-600">{item.metadata?.title}</Text>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">{item.content}</Text>
              <Text className="mt-1 text-xs text-primary">
                Hook: {item.metadata?.hookText} · {item.metadata?.duration}s
              </Text>
            </ContentItem>
          );
        })}
      </Section>
    </View>
  );
}

function Section({ icon, title, count, onGenerate, loading, children }) {
  return (
    <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2">
          <Icon as={icon} size={16} className="text-primary" />
          <Text className="text-sm font-600">
            {title}
            {count > 0 ? <Text className="text-xs text-muted-foreground"> ({count})</Text> : null}
          </Text>
        </View>
        <Button
          size="sm"
          variant="outline"
          icon={Plus}
          onPress={onGenerate}
          loading={loading}
          className="rounded-full"
        >
          {loading ? "Generating…" : "Generate"}
        </Button>
      </View>
      {count === 0 && !loading ? (
        <Text className="text-sm text-muted-foreground">No {title.toLowerCase()} yet. Click Generate to create some.</Text>
      ) : (
        <View className="gap-2">{children}</View>
      )}
    </View>
  );
}
