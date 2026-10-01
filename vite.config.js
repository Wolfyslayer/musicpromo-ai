import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import base44 from "@base44/vite-plugin";

const root = fileURLToPath(new URL(".", import.meta.url));

const ORT_WASM_FILES = [
  "ort-wasm.wasm",
  "ort-wasm-simd.wasm",
  "ort-wasm-threaded.wasm",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-threaded.worker.js",
];

/** Self-host ONNX Runtime wasm so the lyrics worker does not depend on a CDN path. */
function copyOrtWasm() {
  return {
    name: "copy-ort-wasm",
    buildStart() {
      const srcDir = resolve(root, "node_modules/onnxruntime-web/dist");
      const destDir = resolve(root, "public/ort");
      mkdirSync(destDir, { recursive: true });
      for (const file of ORT_WASM_FILES) {
        copyFileSync(resolve(srcDir, file), resolve(destDir, file));
      }
    },
  };
}

const emptyModule = resolve(root, "src/shims/emptyModule.js");
const onnxWeb = resolve(root, "src/shims/onnxRuntimeWeb.js");

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    copyOrtWasm(),
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === "true",
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true,
    }),
    react(),
  ],
  resolve: {
    alias: {
      fs: emptyModule,
      path: emptyModule,
      url: emptyModule,
      sharp: emptyModule,
      "onnxruntime-node": emptyModule,
      "onnxruntime-web": onnxWeb,
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["@xenova/transformers", "onnxruntime-web"],
  },
});
