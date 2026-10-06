import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import WizardStepIntro from "@/components/ux/WizardStepIntro";
import { formatPublishProvidersLabel, normalizeProviderId } from "@/services/social/dayPlatform";
import { loadWizardPlanDays } from "@/services/releaseWizardPlan";
import { fmtDate } from "@/services/format";

const PLATFORM_OPTIONS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X" },
];

function togglePlatform(list, id) {
  const set = new Set((list || []).map(normalizeProviderId).filter(Boolean));
  if (set.has(id)) set.delete(id);
  else set.add(id);
  const next = [...set];
  return next.length ? next : [id];
}

export default function ReleasePlatformAssignStep({
  releaseId,
  campaignIds,
  defaultPlatforms,
  onRowsChange,
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadWizardPlanDays({ releaseId, campaignIds })
      .then((loaded) => {
        if (cancelled) return;
        const defaults = (defaultPlatforms || ["tiktok", "instagram", "youtube"]).map(normalizeProviderId).filter(Boolean);
        setRows(
          loaded.map((d) => ({
            ...d,
            publish_platforms:
              Array.isArray(d.publish_platforms) && d.publish_platforms.length
                ? d.publish_platforms.map(normalizeProviderId).filter(Boolean)
                : [...defaults],
          }))
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [releaseId, campaignIds, defaultPlatforms]);

  useEffect(() => {
    onRowsChange?.(rows);
  }, [rows, onRowsChange]);

  const byCampaign = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = r.campaignId || r.campaign_id;
      if (!map.has(key)) map.set(key, { name: r.campaignName, days: [] });
      map.get(key).days.push(r);
    });
    return [...map.entries()];
  }, [rows]);

  const applyPlatformToAll = (platformId) => {
    setRows((prev) =>
      prev.map((row) => {
        const set = new Set(row.publish_platforms || []);
        set.add(platformId);
        return { ...row, publish_platforms: [...set] };
      })
    );
  };

  const updateRow = (id, publish_platforms) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, publish_platforms } : r)));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Loading plan days…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <WizardStepIntro
        title="Platforms"
        description="Generate promo videos on the previous step first — then you can choose where each plan day publishes."
      />
    );
  }

  return (
    <div className="space-y-5">
      <WizardStepIntro
        title="Where each promo goes"
        description="Choose social platforms for every plan day. Each day can post to one or more networks when you schedule or auto-publish."
      />

      <div className="flex flex-wrap gap-2">
        <span className="w-full text-xs font-medium text-muted-foreground">Quick add to all days</span>
        {PLATFORM_OPTIONS.map((p) => (
          <Button key={p.id} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => applyPlatformToAll(p.id)}>
            + {p.label}
          </Button>
        ))}
      </div>

      <div className="space-y-6">
        {byCampaign.map(([campaignId, group]) => (
          <div key={campaignId} className="space-y-3">
            <h3 className="font-heading text-sm font-semibold text-foreground">{group.name}</h3>
            <ul className="space-y-2">
              {group.days.map((day) => (
                <li
                  key={day.id}
                  className="rounded-2xl border border-border/60 bg-card/40 p-3 sm:flex sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Day {day.day_number}
                      {day.date ? ` · ${fmtDate(day.date)}` : ""}
                      {day.video_template ? ` · ${day.video_template}` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground">{day.hook || day.objective || "Promo post"}</p>
                    <p className="mt-1 text-xs text-primary">{formatPublishProvidersLabel(day.publish_platforms) || "No platforms"}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-0 sm:max-w-[14rem] sm:justify-end">
                    {PLATFORM_OPTIONS.map((p) => {
                      const active = (day.publish_platforms || []).includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => updateRow(day.id, togglePlatform(day.publish_platforms, p.id))}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                            active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
