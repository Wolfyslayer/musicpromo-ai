import { useEffect, useRef } from "react";
import { kickCampaignWorker } from "@/services/socialService";

/** Nudge while the tab is visible (complements GitHub cron — see docs/AUTO_PUBLISH.md). */
const VISIBLE_KICK_INTERVAL_MS = 120_000;
/** Catch up soon after returning to the tab. */
const WAKE_BURST_INTERVAL_MS = 20_000;
const WAKE_BURST_COUNT = 3;

/**
 * Keeps auto-publish moving while a signed-in user has the app open — does not
 * replace GitHub/cron, but avoids waiting up to 5 minutes when nobody is on the plan page.
 */
export function useGlobalAutoPublishKick(enabled) {
  const burstRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;

    const runKick = () => {
      kickCampaignWorker({ skipVideo: true, skipStats: true, batchLimit: 20 }).catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      burstRef.current = 0;
      runKick();
    };

    runKick();
    document.addEventListener("visibilitychange", onVisibility);

    const visibleInterval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      runKick();
    }, VISIBLE_KICK_INTERVAL_MS);

    const burstInterval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (burstRef.current >= WAKE_BURST_COUNT) return;
      burstRef.current += 1;
      runKick();
    }, WAKE_BURST_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(visibleInterval);
      clearInterval(burstInterval);
    };
  }, [enabled]);
}
