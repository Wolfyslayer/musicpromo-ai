import { useEffect, useRef } from "react";
import { kickCampaignWorker } from "@/services/socialService";

const KICK_INTERVAL_MS = 90_000;
const MAX_KICKS = 8;

/**
 * When a scheduled_at is in the past, nudge campaignWorker periodically so
 * posts publish without waiting for GitHub cron.
 */
export function useOverdueAutoPublish(iso, enabled = true) {
  const kicksRef = useRef(0);

  useEffect(() => {
    kicksRef.current = 0;
  }, [iso]);

  useEffect(() => {
    if (!enabled || !iso) return undefined;

    const tick = () => {
      const target = Date.parse(iso);
      if (Number.isNaN(target) || target > Date.now()) return;
      if (kicksRef.current >= MAX_KICKS) return;
      kicksRef.current += 1;
      kickCampaignWorker({ skipVideo: true, skipStats: true, batchLimit: 15 }).catch(() => {});
    };

    tick();
    const id = setInterval(tick, KICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [iso, enabled]);
}
