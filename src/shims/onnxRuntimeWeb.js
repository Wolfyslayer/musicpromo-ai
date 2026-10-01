/**
 * ONNX Runtime's browser build is a UMD script. Vite serves it without ESM
 * exports, but loading it sets `globalThis.ort`. Re-export that object so
 * Transformers.js can read `env.wasm`.
 */
import "../../node_modules/onnxruntime-web/dist/ort.wasm.min.js";

const ort = globalThis.ort;
if (!ort?.env?.wasm) {
  throw new Error("ONNX Runtime failed to start in this browser.");
}

export default ort;
export const InferenceSession = ort.InferenceSession;
export const Tensor = ort.Tensor;
export const env = ort.env;
export const registerBackend = ort.registerBackend;
