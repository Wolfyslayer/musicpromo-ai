const entities = [
  "Artist",
  "Campaign",
  "Song",
  "Release",
  "VideoProject",
  "AnalyticsEntry",
];
const deleted = {};
for (const name of entities) {
  const rows =
    (await base44.entities[name].filter({ is_demo: true }, "-created_date", 500).catch(() => [])) ||
    [];
  let n = 0;
  for (const r of rows) {
    await base44.entities[name].delete(r.id);
    n += 1;
  }
  deleted[name] = n;
}

// Backfill user_id on CampaignDay / VideoProject owned by created_by_id when missing
let daysFixed = 0;
const days = (await base44.entities.CampaignDay.list("-created_date", 500).catch(() => [])) || [];
for (const d of days) {
  if (!d.user_id && d.created_by_id) {
    await base44.entities.CampaignDay.update(d.id, { user_id: d.created_by_id });
    daysFixed += 1;
  }
}
let videosFixed = 0;
const videos = (await base44.entities.VideoProject.list("-created_date", 500).catch(() => [])) || [];
for (const v of videos) {
  if (!v.user_id && v.created_by_id) {
    await base44.entities.VideoProject.update(v.id, { user_id: v.created_by_id });
    videosFixed += 1;
  }
}

console.log(JSON.stringify({ deleted, daysFixed, videosFixed }));
