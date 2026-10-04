import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { loadCampaign } from "@/services/data";

const CampaignContext = createContext(null);

export function CampaignProvider({ children }) {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    if (!id) return Promise.resolve();
    return loadCampaign(id)
      .then((payload) => {
        setError("");
        setData(payload);
      })
      .catch((e) => {
        setData(null);
        setError(e.message || "Failed to load campaign");
      });
  }, [id]);

  useEffect(() => {
    setData(null);
    setError("");
    reload();
  }, [reload]);

  const value = useMemo(
    () => ({
      id,
      data,
      error,
      reload,
      campaign: data?.campaign ?? null,
      song: data?.song ?? null,
      artist: data?.artist ?? null,
      days: data?.days ?? [],
      analytics: data?.analytics ?? null,
      videos: data?.videos ?? [],
      content: data?.content ?? [],
      release: data?.release ?? null,
    }),
    [id, data, error, reload]
  );

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

export function useCampaign() {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaign must be used within CampaignProvider");
  return ctx;
}
