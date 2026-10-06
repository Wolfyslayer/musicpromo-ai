import { db } from "@/api/base44Client";

const LIST_LIMIT = 500;

/** Campaign plan days for the publish step (new or existing campaigns on a release). */
export async function loadWizardPlanDays({ releaseId, campaignIds = [] }) {
  let ids = [...new Set((campaignIds || []).filter(Boolean))];
  if (!ids.length && releaseId) {
    const campaigns = await db.entities.Campaign.filter({ release_id: releaseId }, "-created_date", LIST_LIMIT).catch(
      () => []
    );
    ids = campaigns.map((c) => c.id);
  }
  if (!ids.length) return [];

  const dayGroups = await Promise.all(
    ids.map((campaignId) =>
      db.entities.CampaignDay.filter({ campaign_id: campaignId }, "day_number", LIST_LIMIT).catch(() => [])
    )
  );

  const campaigns = await Promise.all(
    ids.map((id) => db.entities.Campaign.get(id).catch(() => null))
  );

  const rows = [];
  dayGroups.forEach((days, index) => {
    const campaign = campaigns[index];
    (days || []).forEach((day) => {
      rows.push({
        ...day,
        campaignName: campaign?.name || "Campaign",
        campaignId: campaign?.id || day.campaign_id,
      });
    });
  });

  return rows.sort((a, b) => {
    const ca = String(a.campaignId || "");
    const cb = String(b.campaignId || "");
    if (ca !== cb) return ca.localeCompare(cb);
    return (a.day_number || 0) - (b.day_number || 0);
  });
}

export async function saveWizardDayPlatforms(dayRows) {
  await Promise.all(
    (dayRows || []).map((row) =>
      db.entities.CampaignDay.update(row.id, {
        publish_platforms: row.publish_platforms || [],
      })
    )
  );
}
