import { Asset } from "expo-asset";
import { readAsStringAsync } from "expo-file-system/legacy";
import { createElement, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { profileFromSamples } from "@/lib/assets";
import { groupWhisperChunks, type LyricCue } from "@/lib/lyrics";

type RenderResult = {
  base64: string;
  width: number;
  height: number;
  duration: number;
  visualStyle?: string;
  particleEffect?: string;
  lyricCues?: LyricCue[];
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type EngineProgress = { progress: number; message: string };

type EngineApi = {
  ready: boolean;
  error: string;
  progress: EngineProgress | null;
  analyze: (input: { artworkUrl?: string; audioUrl?: string; title?: string; energy?: string }) => Promise<ReturnType<typeof profileFromSamples>>;
  syncLyrics: (input: { audioUrl: string; duration?: number }) => Promise<LyricCue[]>;
  renderPromo: (input: Record<string, unknown>) => Promise<RenderResult>;
};

const EngineContext = createContext<EngineApi | null>(null);

const BRIDGE = `
window.__post = function (message) {
  var payload = JSON.stringify(message);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
  else if (window.parent) window.parent.postMessage(payload, "*");
};
window.addEventListener("message", function (event) {
  var data = event.data;
  if (!data || data.type !== "musicpromo-eval" || typeof data.script !== "string") return;
  try { (0, eval)(data.script); }
  catch (error) {
    window.__post({ type: "error", task: "render", message: error && error.message ? error.message : "The device engine failed." });
  }
});
function loadImage(url) {
  return new Promise(function (resolve, reject) {
    var image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = function () { resolve(image); };
    image.onerror = function () { reject(new Error("Artwork could not be read.")); };
    image.src = url;
  });
}
window.__musicpromoAnalyze = async function (params) {
  try {
    var color = null;
    if (params.artworkUrl) {
      var image = await loadImage(params.artworkUrl);
      var canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 24;
      var context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, 24, 24);
      var pixels = context.getImageData(0, 0, 24, 24).data;
      var r = 0, g = 0, b = 0, count = 0;
      for (var i = 0; i < pixels.length; i += 16) {
        r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count += 1;
      }
      color = { r: r / Math.max(1, count), g: g / Math.max(1, count), b: b / Math.max(1, count) };
    }
    var sound = null;
    if (params.audioUrl) {
      var ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      var bytes = await fetch(params.audioUrl).then(function (response) { return response.arrayBuffer(); });
      var audio = await ctx.decodeAudioData(bytes.slice(0));
      var channel = audio.getChannelData(0);
      var step = Math.max(1, Math.floor(channel.length / 12000));
      var sum = 0, crossings = 0, previous = 0, samples = 0;
      for (var n = 0; n < channel.length; n += step) {
        var sample = channel[n];
        sum += sample * sample;
        if ((sample >= 0 && previous < 0) || (sample < 0 && previous >= 0)) crossings += 1;
        previous = sample;
        samples += 1;
      }
      var rms = Math.sqrt(sum / Math.max(1, samples));
      var rate = crossings / Math.max(1, samples);
      sound = { energy: rms > 0.12 || rate > 0.16 ? "fast" : "slow", rms: Math.round(rms * 1000) / 1000, duration: audio.duration };
      await ctx.close();
    }
    window.__post({ type: "analysis", color: color, sound: sound });
  } catch (error) {
    window.__post({ type: "error", task: "analyze", message: error && error.message ? error.message : "Could not analyze the song." });
  }
};
window.__musicpromoSync = async function (params) {
  var LISTENING = "AI is listening and syncing your lyrics...";
  try {
    window.__post({ type: "progress", task: "sync", progress: 3, message: LISTENING });
    var ctx = new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    var encoded = await fetch(params.audioUrl).then(function (response) {
      if (!response.ok) throw new Error("Could not load the song audio for lyrics sync.");
      return response.arrayBuffer();
    });
    var decoded = await ctx.decodeAudioData(encoded.slice(0));
    var duration = Math.min(600, Math.max(1, Number(params.duration) || decoded.duration || 15));
    var seconds = Math.min(duration, decoded.duration || duration);
    var length = Math.max(1, Math.ceil(seconds * 16000));
    var offline = new OfflineAudioContext(1, length, 16000);
    var source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    var rendered = await offline.startRendering();
    await ctx.close();
    var pcm = rendered.getChannelData(0);
    window.__post({ type: "progress", task: "sync", progress: 8, message: LISTENING });
    var transformers = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm");
    transformers.env.allowLocalModels = false;
    if (transformers.env.backends && transformers.env.backends.onnx && transformers.env.backends.onnx.wasm) {
      transformers.env.backends.onnx.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/";
      transformers.env.backends.onnx.wasm.numThreads = 1;
    }
    var transcriber = await transformers.pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
      quantized: true,
      progress_callback: function (update) {
        if (update && update.status === "progress") {
          window.__post({ type: "progress", task: "sync", progress: Math.max(10, Math.min(70, Math.round(update.progress || 20))), message: LISTENING });
        }
      }
    });
    window.__post({ type: "progress", task: "sync", progress: 72, message: LISTENING });
    var output;
    try {
      output = await transcriber(pcm, { chunk_length_s: 20, return_timestamps: "word" });
    } catch (err) {
      output = await transcriber(pcm, { chunk_length_s: 20, return_timestamps: true });
    }
    window.__post({
      type: "lyrics",
      chunks: Array.isArray(output && output.chunks) ? output.chunks : [],
      text: String((output && output.text) || ""),
      duration: duration
    });
  } catch (error) {
    window.__post({ type: "error", task: "sync", message: error && error.message ? error.message : "Lyrics sync failed." });
  }
};
window.__post({ type: "ready" });
true;
`;

let engineHtml: Promise<string> | null = null;

export function loadEngineHtml() {
  if (!engineHtml) {
    engineHtml = (async () => {
      const asset = Asset.fromModule(require("../assets/engine/studio.bundle"));
      await asset.downloadAsync();
      const candidates = [asset.uri, asset.localUri].filter((value): value is string => Boolean(value));
      let studio = "";
      let lastError: unknown = null;
      for (const uri of candidates) {
        try {
          if (uri.startsWith("http") || uri.startsWith("/") || uri.startsWith("blob:")) {
            const response = await fetch(uri);
            if (!response.ok) throw new Error(`Renderer bundle request failed (${response.status}).`);
            studio = await response.text();
          } else {
            studio = await readAsStringAsync(uri);
          }
          if (studio.includes("__musicpromoRender")) break;
          studio = "";
        } catch (error) {
          lastError = error;
          studio = "";
        }
      }
      if (!studio) throw lastError instanceof Error ? lastError : new Error("Could not read the on-device renderer.");
      const safeStudio = studio.replace(/<\/script/gi, "<\\/script");
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script>${safeStudio}</script><script>${BRIDGE}</script></body></html>`;
    })().catch((error) => {
      engineHtml = null;
      throw error;
    });
  }
  return engineHtml;
}

function WebEngineFrame({ html, frameRef }: { html: string; frameRef: React.RefObject<HTMLIFrameElement | null> }) {
  return createElement("iframe", {
    ref: frameRef,
    srcDoc: html,
    style: { width: 1, height: 1, border: 0, opacity: 0 },
  });
}

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const webview = useRef<WebView>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const pending = useRef<Record<string, Pending>>({});
  const chunks = useRef<string[]>([]);
  const queue = useRef<string[]>([]);
  const [ready, setReady] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [progress, setProgress] = useState<EngineProgress | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const documentHtml = await loadEngineHtml();
      if (!active) return;
      setHtml(documentHtml);
    })().catch((error) => {
      console.warn("[engine]", error);
      if (active) setEngineError(error instanceof Error ? error.message : "The on-device renderer failed to load.");
    });
    return () => {
      active = false;
    };
  }, []);

  const settle = (task: string, error: Error | null, value?: unknown) => {
    const job = pending.current[task];
    if (!job) return;
    delete pending.current[task];
    if (error) job.reject(error);
    else job.resolve(value);
  };

  const runScript = (script: string) => {
    if (Platform.OS === "web") {
      frame.current?.contentWindow?.postMessage({ type: "musicpromo-eval", script }, "*");
      return;
    }
    webview.current?.injectJavaScript(script);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    let message: Record<string, any> = {};
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === "ready") {
      setReady(true);
      queue.current.splice(0).forEach((script) => runScript(script));
      return;
    }
    if (message.type === "progress") {
      setProgress({
        progress: Number(message.progress) || 0,
        message: String(message.message || ""),
      });
      return;
    }
    if (message.type === "chunk") {
      chunks.current[message.index] = message.data;
      return;
    }
    if (message.type === "error") {
      chunks.current = [];
      settle(message.task || "render", new Error(message.message || "The device engine failed."));
      return;
    }
    if (message.type === "analysis") {
      settle("analyze", null, { color: message.color, sound: message.sound });
      return;
    }
    if (message.type === "lyrics") {
      const chunksIn = Array.isArray(message.chunks) && message.chunks.length
        ? message.chunks
        : message.text
          ? [{ text: message.text, timestamp: [0, message.duration || 15] }]
          : [];
      settle("sync", null, groupWhisperChunks(chunksIn, message.duration || 15));
      return;
    }
    if (message.type === "done") {
      const base64 = chunks.current.join("");
      chunks.current = [];
      settle("render", null, { ...message, base64 });
    }
  };

  const call = useCallback((task: string, script: string) => {
    return new Promise((resolve, reject) => {
      if (engineError) {
        reject(new Error(engineError));
        return;
      }
      setProgress(null);
      pending.current[task] = { resolve, reject };
      const frameReady = Platform.OS === "web" ? Boolean(frame.current?.contentWindow) : Boolean(webview.current);
      if (ready && frameReady) runScript(script);
      else queue.current.push(script);
    });
  }, [engineError, ready]);

  const api = useMemo<EngineApi>(() => ({
    ready,
    error: engineError,
    progress,
    analyze: async (input) => {
      const samples = await call("analyze", `window.__musicpromoAnalyze(${JSON.stringify(input)}); true;`) as {
        color?: { r: number; g: number; b: number } | null;
        sound?: { energy?: string; rms?: number; duration?: number | null } | null;
      };
      return profileFromSamples({ ...samples, title: input.title, energy: input.energy });
    },
    syncLyrics: (input) => call("sync", `window.__musicpromoSync(${JSON.stringify(input)}); true;`) as Promise<LyricCue[]>,
    renderPromo: (input) => {
      chunks.current = [];
      return call("render", `window.__musicpromoRender(${JSON.stringify(input)}); true;`) as Promise<RenderResult>;
    },
  }), [call, engineError, progress, ready]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      if (frame.current && event.source !== frame.current.contentWindow) return;
      onMessage({ nativeEvent: { data: event.data } } as WebViewMessageEvent);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <EngineContext.Provider value={api}>
      {children}
      {html ? (
        <View style={{ height: 1, width: 1, opacity: 0, position: "absolute" }}>
          {Platform.OS === "web" ? (
            <WebEngineFrame html={html} frameRef={frame} />
          ) : (
            <WebView
              ref={webview}
              originWhitelist={["*"]}
              source={{ html, baseUrl: "https://musicpromo.local" }}
              onMessage={onMessage}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              setSupportMultipleWindows={false}
            />
          )}
        </View>
      ) : null}
    </EngineContext.Provider>
  );
}

export function useEngine() {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error("useEngine must be used within an EngineProvider");
  return engine;
}
