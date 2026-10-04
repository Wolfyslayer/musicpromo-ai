#!/usr/bin/env node
/** Renders public/musicpromo-ai-icon.svg → assets/icon.png (1024²) for Capacitor / Play. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "public", "musicpromo-ai-icon.svg");
const outDir = path.join(root, "assets");
const outPath = path.join(outDir, "icon.png");

const svg = fs.readFileSync(svgPath);
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1024 },
  background: "transparent",
});
const png = resvg.render().asPng();

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, png);
console.log("Wrote", outPath, `(${png.length} bytes)`);
