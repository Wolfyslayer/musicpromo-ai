import { renderPromoRemotion } from "../../src/remotion/renderPromoRemotion.js";

function post(message) {
  const payload = JSON.stringify(message);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
  else window.parent?.postMessage(payload, "*");
}

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
