import { useState } from "react";
import { Globe2, Loader2 } from "lucide-react";
import { db } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import SurfacePanel from "@/components/SurfacePanel";

export default function CampaignCommunityShare({ campaign, onUpdated }) {
  const { toast } = useToast();
  const [shareOn, setShareOn] = useState(campaign?.share_on_community === true);
  const [teaser, setTeaser] = useState(String(campaign?.community_teaser || campaign?.summary || "").slice(0, 280));
  const [saving, setSaving] = useState(false);

  if (!campaign?.id) return null;

  const save = async () => {
    setSaving(true);
    try {
      await db.entities.Campaign.update(campaign.id, {
        share_on_community: shareOn,
        community_teaser: teaser.trim(),
      });
      toast({ title: "Community settings saved" });
      onUpdated?.();
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SurfacePanel className="space-y-4">
      <div className="flex items-start gap-2">
        <Globe2 className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-600">Share on Community</p>
          <p className="text-xs text-muted-foreground">
            Show a teaser in followers&apos; Community feed while this campaign is active or scheduled.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="share-community" className="text-sm font-normal">
          Visible in Community feed
        </Label>
        <Switch id="share-community" checked={shareOn} onCheckedChange={setShareOn} />
      </div>
      <div className="space-y-1.5">
        <Label>Teaser (optional)</Label>
        <Textarea
          value={teaser}
          onChange={(e) => setTeaser(e.target.value.slice(0, 280))}
          rows={3}
          className="rounded-xl"
          placeholder="What should followers know about this rollout?"
          disabled={!shareOn}
        />
      </div>
      <Button type="button" size="sm" className="rounded-full" disabled={saving} onClick={save}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save Community share
      </Button>
    </SurfacePanel>
  );
}
