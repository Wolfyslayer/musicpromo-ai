import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { syncLyricsFromAudio } from "@/services/lyricsSync";

function post(payload) {
  const raw = JSON.stringify(payload);
  if (typeof window !== "undefined" && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(raw);
  }
}

/**
 * Free lyrics sync for the Expo app — runs the same in-browser Whisper worker as the web UI.
 * URL: /mobile-lyrics-sync-bridge
 */
export default function MobileLyricsSyncBridge() {
  const busy = useRef(false);

  useEffect(() => {
    const onMessage = async (event) => {
      let data;
      try {
        data = JSON.parse(typeof event.data === "string" ? event.data : event.nativeEvent?.data);
      } catch {
        return;
      }

      if (data?.type === "setSession" && data.access_token && supabase) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token || "",
        });
        post({ type: "session_ok" });
      }

      if (data?.type === "sync" && !busy.current) {
        busy.current = true;
        try {
          const cues = await syncLyricsFromAudio({
            audioUrl: data.audioUrl,
            durationSec: data.durationSec ?? 15,
            onProgress: (info) => post({ type: "progress", ...info }),
          });
          post({ type: "complete", ok: true, cues });
        } catch (err) {
          post({ type: "complete", ok: false, error: err?.message || "Lyrics sync failed." });
        } finally {
          busy.current = false;
        }
      }
    };

    window.addEventListener("message", onMessage);
    document.addEventListener("message", onMessage);
    post({ type: "ready" });

    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("message", onMessage);
    };
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">
      Free lyrics sync (on-device Whisper, same as web Studio)
    </div>
  );
}
