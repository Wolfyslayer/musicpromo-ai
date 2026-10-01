const videos =
  (await base44.entities.VideoProject.list("-created_date", 500).catch(() => [])) || [];
const campaigns =
  (await base44.entities.Campaign.list("-created_date", 200).catch(() => [])) || [];
const campaignOwner = Object.fromEntries(
  campaigns.map((c) => [c.id, c.created_by_id]).filter(([, id]) => id)
);

let fixed = 0;
let skipped = 0;
const byCampaign = {};

for (const v of videos) {
  const uid = String(v.user_id || "");
  const needsFix = !uid || uid.startsWith("service_");
  if (!needsFix) {
    skipped += 1;
    continue;
  }
  const owner = campaignOwner[v.campaign_id];
  if (!owner || String(owner).startsWith("service_")) {
    skipped += 1;
    continue;
  }
  await base44.entities.VideoProject.update(v.id, { user_id: owner });
  fixed += 1;
  byCampaign[v.campaign_id] = (byCampaign[v.campaign_id] || 0) + 1;
}

console.log(JSON.stringify({ fixed, skipped, byCampaign }, null, 2));
