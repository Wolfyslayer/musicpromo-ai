import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { loadCampaignContent } from "@/services/data";
import ContentWorkspace from "@/components/campaign/ContentWorkspace";

/** Content workspace — nested under {@link CampaignShell} (compact header + section menu). */
export default function CampaignContent() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const focusDayId = params.get("day") || null;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const reload = () =>
    loadCampaignContent(id)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load content"));

  useEffect(() => {
    setError("");
    setData(null);
    reload();
  }, [id]);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <div className="h-64 animate-shimmer rounded-2xl" />;

  const { campaign, song, artist, release, days, content, videos } = data;

  return (
    <ContentWorkspace
      campaign={campaign}
      song={song}
      artist={artist}
      release={release}
      days={days}
      content={content}
      videos={videos}
      onRefresh={reload}
      focusDayId={focusDayId}
      embedLibrary
    />
  );
}
