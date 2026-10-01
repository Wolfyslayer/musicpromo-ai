import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sharedSrc = join(root, "base44", "shared");
const sharedDest = join(root, "supabase", "functions", "_shared");
const functionsSrc = join(root, "base44", "functions");
const functionsDest = join(root, "supabase", "functions");

function rewriteShared(source) {
  return source
    .replaceAll('from "base44:runtime"', 'from "./runtime.ts"')
    .replaceAll("from 'base44:runtime'", "from './runtime.ts'")
    .replaceAll('from "npm:@base44/sdk@0.8.52"', 'from "./runtime.ts"')
    .replaceAll("from 'npm:@base44/sdk@0.8.52'", "from './runtime.ts'");
}

function rewriteFunction(source) {
  let next = source
    .replaceAll('from "npm:@base44/sdk@0.8.52"', 'from "../_shared/runtime.ts"')
    .replaceAll("from 'npm:@base44/sdk@0.8.52'", 'from "../_shared/runtime.ts"')
    .replaceAll('from "base44:runtime"', 'from "../_shared/runtime.ts"')
    .replaceAll("from 'base44:runtime'", "from '../_shared/runtime.ts'")
    .replaceAll('from "../../shared/', 'from "../_shared/');
  if (/export default async function\s*\(/.test(next)) {
    next = next.replace("export default async function", "async function handler");
    next += "\n\nDeno.serve(handler);\n";
  } else if (/export default async function\s+\w+/.test(next)) {
    const name = next.match(/export default async function\s+(\w+)/)[1];
    next = next.replace(`export default async function ${name}`, `async function ${name}`);
    next += `\n\nDeno.serve(${name});\n`;
  } else if (/export default\s+(\w+)\s*;/.test(next)) {
    const name = next.match(/export default\s+(\w+)\s*;/)[1];
    next += `\n\nDeno.serve(${name});\n`;
  }
  return next;
}

mkdirSync(sharedDest, { recursive: true });
for (const file of readdirSync(sharedSrc)) {
  if (!file.endsWith(".ts")) continue;
  if (file === "runtime.ts") continue;
  const source = readFileSync(join(sharedSrc, file), "utf8");
  writeFileSync(join(sharedDest, file), rewriteShared(source));
}

for (const name of readdirSync(functionsSrc, { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  const entry = join(functionsSrc, name.name, "entry.ts");
  const destDir = join(functionsDest, name.name);
  mkdirSync(destDir, { recursive: true });
  const source = readFileSync(entry, "utf8");
  writeFileSync(join(destDir, "index.ts"), rewriteFunction(source));
}

const callback = `import handleMetaOAuthCallback from "../_shared/metaOAuthCallbackHandler.ts";

Deno.serve(handleMetaOAuthCallback);
`;
for (const name of ["meta-oauth-callback", "tiktok-oauth-callback", "youtube-oauth-callback"]) {
  const destDir = join(functionsDest, name);
  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, "index.ts"), callback);
}

console.log("ported", readdirSync(functionsDest).length, "function folders");
