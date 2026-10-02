import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import videoService from "@/services/videoService";
import { syncLyricsFromAudio } from "@/services/lyricsSync";

/**
 * Headless page loaded inside a hidden WebView by the mobile app (`/?mobile-render=1`).
 * It runs the same free, in-browser Remotion/WebCodecs render and Whisper lyric sync as
 * the web app, then reports progress and results back to React Native over postMessage.
 */
function post(message) {
  const bridge = window.ReactNativeWebView;
  if (bridge?.postMessage) bridge.postMessage(JSON.stringify(message));
}

async function applySession({ accessToken, refreshToken }) {
  if (!supabase || !accessToken || !refreshToken) return;
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw new Error(error.message);
}

async function handle(message) {
  const { type, id } = message || {};
  try {
    if (type === "session") {
      await applySession(message);
      post({ type: "session-ok", id });
      return;
    }
    if (type === "render") {
      await applySession(message);
      const result = await videoService.exportVideo(message.project, {
        audioUrl: message.audioUrl,
        onProgress: (info) => post({ type: "progress", id, ...info }),
      });
      post({ type: "result", id, result });
      return;
    }
    if (type === "transcribe") {
      const cues = await syncLyricsFromAudio({
        audioUrl: message.audioUrl,
        durationSec: message.durationSec,
        onProgress: (info) => post({ type: "progress", id, ...info }),
      });
      post({ type: "result", id, result: { cues } });
    }
  } catch (err) {
    post({ type: "error", id, message: err?.message || String(err) });
  }
}

export default function MobileRenderHost() {
  useEffect(() => {
    const onMessage = (event) => {
      let parsed = event.data;
      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          return;
        }
      }
      handle(parsed);
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
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, fontSize: 12, color: "#64748b" }}>
      MusicPromo AI render host
    </div>
  );
}
