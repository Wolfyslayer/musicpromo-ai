import { createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@remotion/player";
import { PromoComposition } from "../../src/remotion/PromoComposition.jsx";
import { renderPromoRemotion } from "../../src/remotion/renderPromoRemotion.js";
import {
  PROMO_FPS,
  PROMO_HEIGHT,
  PROMO_WIDTH,
  buildLyricCues,
  normalizeEditorLook,
  normalizeParticleEffect,
  normalizeVideoType,
  normalizeVisualStyle,
  resolveStudioDuration,
} from "../../src/remotion/styles.js";

function post(message) {
  const payload = JSON.stringify(message);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
  else window.parent?.postMessage(payload, "*");
}

function Preview() {
  const [state, setState] = useState(null);
  useEffect(() => {
    window.__musicpromoPreview = (next) => setState(next || null);
  }, []);
  if (!state?.artworkUrl && !state?.audioUrl) {
    return createElement(
      "div",
      { style: { color: "#c4b5fd", font: "14px sans-serif", padding: 16, background: "#0c0b10", height: "100%" } },
      "Add artwork and audio to preview."
    );
  }
  const videoType = normalizeVideoType(state.videoType) || "promo";
  const durationSec = resolveStudioDuration(videoType, state.duration, state.audioDuration);
  const inputProps = {
    artworkUrl: state.artworkUrl || "",
    audioUrl: state.audioUrl || "",
    title: state.title || "",
    artistName: state.artistName || "",
    text: state.text || "",
    visualStyle: normalizeVisualStyle(state.visualStyle),
    particleEffect: normalizeParticleEffect(state.particleEffect),
    look: normalizeEditorLook(state.look),
    audioStartTimeOffset: Math.max(0, Number(state.audioStartTimeOffset) || 0),
    videoType,
    outroCta: state.outroCta || "",
    lyricCues: buildLyricCues(state.lyrics, durationSec, state.lyricCues),
  };
  return createElement(
    "div",
    { style: { width: "100%", height: "100%", background: "#000" } },
    createElement(Player, {
      component: PromoComposition,
      inputProps,
      durationInFrames: Math.max(1, Math.round(durationSec * PROMO_FPS)),
      compositionWidth: PROMO_WIDTH,
      compositionHeight: PROMO_HEIGHT,
      fps: PROMO_FPS,
      style: { width: "100%", height: "100%" },
      controls: false,
      loop: true,
      autoPlay: state.playing !== false,
      acknowledgeRemotionLicense: true,
    })
  );
}

const mount = document.createElement("div");
mount.id = "preview";
mount.style.cssText = "position:fixed;inset:0;background:#000";
document.body.style.margin = "0";
document.body.appendChild(mount);
createRoot(mount).render(createElement(Preview));

window.__musicpromoRender = async function render(params) {
  try {
    const rendered = await renderPromoRemotion({
      ...params,
      onProgress: (info) => post({ type: "progress", ...info }),
    });
    const buffer = await rendered.blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode(...bytes.subarray(i, i + step));
    }
    const base64 = btoa(binary);
    const piece = 120000;
    const parts = Math.max(1, Math.ceil(base64.length / piece));
    for (let index = 0; index < parts; index += 1) {
      post({
        type: "chunk",
        index,
        parts,
        data: base64.slice(index * piece, (index + 1) * piece),
      });
    }
    post({
      type: "done",
      width: rendered.width,
      height: rendered.height,
      duration: rendered.duration,
      visualStyle: rendered.visualStyle,
      particleEffect: rendered.particleEffect,
      lyricCues: rendered.lyricCues,
    });
  } catch (error) {
    post({ type: "error", message: error?.message || "Render failed." });
  }
};

post({ type: "ready" });
