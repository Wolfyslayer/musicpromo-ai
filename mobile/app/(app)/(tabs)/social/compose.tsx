import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Card, Field, Muted, P, Screen } from "@/components/ui";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";
import { createPost, publishPost } from "@/lib/social";

export default function Compose() {
  const params = useLocalSearchParams<{ campaign?: string; day?: string; release?: string; post?: string }>();
  const { requireAuth } = useAuth();
  const { toast } = useToast();
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!params.day) return;
    db.entities.CampaignDay.get(String(params.day))
      .then((day) => {
        const tags = Array.isArray(day.hashtags) ? day.hashtags.join(" ") : day.hashtags || "";
        setCaption([day.caption, tags].filter(Boolean).join("\n"));
        setMediaUrl(day.media_url || "");
      })
      .catch(() => {});
  }, [params.day]);

  const save = async (publish: boolean) => {
    if (!requireAuth()) return;
    setBusy(publish ? "publish" : "save");
    try {
      const created = await createPost({
        caption,
        mediaUrl,
        mediaType: mediaUrl ? "IMAGE" : "TEXT",
        campaignId: params.campaign || null,
        campaignDayId: params.day || null,
        releaseId: params.release || null,
        platform: "instagram",
      });
      const postId = created.data?.id || created.data?.post?.id || params.post;
      if (publish && postId) {
        await publishPost(String(postId));
        toast({ title: "Publish requested" });
      } else {
        toast({ title: "Draft saved" });
      }
    } catch (err) {
      toast({ title: publish ? "Publish failed" : "Save failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  return (
    <Screen>
      <View className="gap-4">
        <Card className="gap-1">
          <P className="font-semibold">Instagram draft</P>
          <Muted>Caption limit on Instagram is 2,200 characters. Publishing uses the same edge function as the web app.</Muted>
        </Card>
        <Field label="Caption" value={caption} onChangeText={setCaption} placeholder="Write the post…" multiline />
        <Field label="Media URL" value={mediaUrl} onChangeText={setMediaUrl} placeholder="https://" autoCapitalize="none" />
        <Button label="Save draft" variant="outline" loading={busy === "save"} onPress={() => save(false)} />
        <Button label="Publish" loading={busy === "publish"} onPress={() => save(true)} />
      </View>
    </Screen>
  );
}