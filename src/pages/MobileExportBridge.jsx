import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { videoService, resolvePlayableAudioUrl } from "@/services/videoService";
import { selectVideoProject } from "@/services/studioRecords";

function post(payload) {
  const raw = JSON.stringify(payload);
  if (typeof window !== "undefined" && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(raw);
  }
}

/**
 * Headless Remotion export bridge for the Expo app WebView.
 * URL: /mobile-export-bridge?projectId=...
 */
export default function MobileExportBridge() {
  const [status, setStatus] = useState("Waiting for session…");
  const started = useRef(false);

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
        setStatus("Signed in — ready to render.");
        post({ type: "session_ok" });
      }
      if (data?.type === "export" && data.projectId && !started.current) {
        started.current = true;
        runExport(String(data.projectId));
      }
    };

    window.addEventListener("message", onMessage);
    document.addEventListener("message", onMessage);
    post({ type: "ready" });

    const projectId = new URLSearchParams(window.location.search).get("projectId");
    if (projectId && !started.current) {
      started.current = true;
      runExport(projectId);
    }

    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("message", onMessage);
    };
  }, []);

  async function runExport(projectId) {
    try {
      if (!supabase) throw new Error("Supabase is not configured.");
      setStatus("Loading video project…");
      const project = await selectVideoProject(projectId);
      if (!project) throw new Error("Project not found.");

      const audioUrl = await resolvePlayableAudioUrl(project.audio_url);
      setStatus("Rendering MP4 with Remotion…");

      const res = await videoService.exportVideo(project, {
        audioUrl,
        onProgress: (info) => {
          post({ type: "progress", ...info });
          setStatus(info?.message || "Rendering…");
        },
      });

      post({ type: "complete", ...res });
      setStatus(res?.status === "ready" ? "Done — returning to app…" : res?.message || "Export finished.");
    } catch (err) {
      const message = err?.message || "Export failed.";
      post({ type: "complete", status: "failed", message });
      setStatus(message);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">
      {status}
    </div>
  );
}
