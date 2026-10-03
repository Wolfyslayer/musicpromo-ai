import { useEffect, useState } from "react";
import { Lightbulb, Loader2, Sparkles } from "lucide-react";
import SurfacePanel from "@/components/SurfacePanel";
import { useToast } from "@/components/ui/use-toast";
import { loadCampaignPlanInsights } from "@/services/planInsightsService";

export default function CampaignPlanInsights({ campaignId }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!campaignId) return undefined;
    (async () => {
      setLoading(true);
      try {
        const data = await loadCampaignPlanInsights(campaignId);
        if (!cancelled) {
          setSummary(data.summary);
          setSuggestions(data.suggestions || []);
        }
      } catch (e) {
        if (!cancelled) {
          toast({
            variant: "destructive",
            title: "Plan insights unavailable",
            description: e.message,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, toast]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!suggestions.length && !summary?.analyticsCount) {
    return (
      <SurfacePanel className="text-sm text-muted-foreground">
        Log analytics on published posts to unlock performance-based plan suggestions.
      </SurfacePanel>
    );
  }

  return (
    <SurfacePanel className="space-y-4">
      <div className="flex gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="font-heading font-semibold">Plan insights</p>
          <p className="text-xs text-muted-foreground">
            From {summary?.analyticsCount || 0} analytics entries
            {summary?.topPlatform?.name ? ` · top platform ${summary.topPlatform.name}` : ""}
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="flex gap-2 rounded-xl border border-border/50 px-3 py-2.5 text-sm"
          >
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="font-600">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </SurfacePanel>
  );
}
