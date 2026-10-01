import { env, pipeline } from "@xenova/transformers";
import { createModelCache } from "./modelCache";

const MODEL_ID = "Xenova/whisper-tiny";
const LISTENING = "AI is listening and syncing your lyrics...";

let initError = "";

try {
  env.allowLocalModels = false;
  env.useBrowserCache = false;
  env.useFSCache = false;
  env.useCustomCache = true;
  env.customCache = createModelCache();
  const wasm = env.backends?.onnx?.wasm;
  if (!wasm) {
    throw new Error("ONNX runtime did not expose a WASM backend.");
  }
  wasm.wasmPaths = "/ort/";
  wasm.numThreads = 1;
} catch (err) {
  initError = err?.message || "Could not start the lyrics model.";
}

let transcriberPromise = null;
const downloadState = new Map();
let downloadShown = 6;

function reportDownload(update) {
  const file = update?.file;
  if (!file) return;

  if (update.status === "progress") {
    const total = Number(update.total) || 0;
    const loaded = Number(update.loaded) || 0;
    const fromEvent = Number(update.progress);
    const ratio = total > 0 ? loaded / total : Number.isFinite(fromEvent) ? fromEvent / 100 : 0;
    downloadState.set(file, Math.max(downloadState.get(file) || 0, Math.min(1, ratio)));
  } else if (update.status === "done") {
    downloadState.set(file, 1);
  } else if (update.status === "initiate") {
    if (!downloadState.has(file)) downloadState.set(file, 0);
  } else {
    return;
  }

  let sum = 0;
  for (const ratio of downloadState.values()) sum += ratio;
  const overall = downloadState.size ? sum / downloadState.size : 0;
  const next = Math.max(6, Math.min(68, Math.round(overall * 68)));
  downloadShown = Math.max(downloadShown, next);
  postMessage({
    type: "progress",
    phase: "download",
    progress: downloadShown,
    message: LISTENING,
  });
}

function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = pipeline("automatic-speech-recognition", MODEL_ID, {
      quantized: true,
      progress_callback: reportDownload,
    }).catch((err) => {
      transcriberPromise = null;
      throw err;
    });
  }
  return transcriberPromise;
}

let busy = false;

self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type !== "transcribe") return;
  if (busy) {
    postMessage({ type: "error", message: "Lyrics sync is already running." });
    return;
  }
  busy = true;

  let ticker = 0;
  let transcribeProgress = 70;
  try {
    if (initError) throw new Error(initError);
    const audio = data.audio;
    if (!(audio instanceof Float32Array) || audio.length < 1600) {
      throw new Error("The audio clip is too short to transcribe.");
    }

    postMessage({ type: "progress", phase: "download", progress: 6, message: LISTENING });
    const transcriber = await getTranscriber();

    postMessage({ type: "progress", phase: "transcribe", progress: 70, message: LISTENING });
    ticker = setInterval(() => {
      transcribeProgress = Math.min(92, transcribeProgress + 2);
      postMessage({
        type: "progress",
        phase: "transcribe",
        progress: transcribeProgress,
        message: LISTENING,
      });
    }, 700);

    const duration = Math.max(1, Number(data.duration) || 15);
    const chunkCount = Math.max(1, Math.ceil(audio.length / (16000 * 20)));
    let finishedChunks = 0;
    const transcribeOptions = {
      chunk_length_s: 20,
      chunk_callback: () => {
        finishedChunks += 1;
        const ratio = finishedChunks / chunkCount;
        transcribeProgress = Math.max(transcribeProgress, Math.min(96, 70 + Math.round(ratio * 26)));
        postMessage({
          type: "progress",
          phase: "transcribe",
          progress: transcribeProgress,
          message: LISTENING,
        });
      },
    };
    let output;
    try {
      output = await transcriber(audio, {
        ...transcribeOptions,
        return_timestamps: "word",
      });
    } catch (err) {
      const message = String(err?.message || err);
      if (!/timestamp/i.test(message)) throw err;
      output = await transcriber(audio, {
        ...transcribeOptions,
        return_timestamps: true,
      });
    }

    postMessage({ type: "progress", phase: "transcribe", progress: 100, message: LISTENING });
    postMessage({
      type: "done",
      chunks: Array.isArray(output?.chunks) ? output.chunks : [],
      text: String(output?.text || ""),
      duration,
    });
  } catch (err) {
    postMessage({
      type: "error",
      message: err?.message || "Lyrics sync failed.",
    });
  } finally {
    if (ticker) clearInterval(ticker);
    busy = false;
  }
};
