import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { CircuitArtifacts } from "./types.js";

/** Load artifacts.json sitting next to wasm/zkey files */
export async function loadArtifacts(artifactsJsonUrl: string): Promise<CircuitArtifacts> {
  const url = toURL(artifactsJsonUrl);
  const baseDir = dirname(fileURLToPath(url));
  const raw = await readFile(fileURLToPath(url), "utf8");
  const parsed = JSON.parse(raw) as CircuitArtifacts;

  // Normalize to absolute file: URLs for uniform handling
  return {
    wasm: pathToFileURL(resolve(baseDir, parsed.wasm)).toString(),
    zkey: pathToFileURL(resolve(baseDir, parsed.zkey)).toString(),
    vkey: parsed.vkey ? pathToFileURL(resolve(baseDir, parsed.vkey)).toString() : undefined
  };
}

export async function loadJSON<T = unknown>(fileUrl: string): Promise<T> {
  const buf = await readFile(fileURLToPath(fileUrl), "utf8");
  return JSON.parse(buf) as T;
}

function toURL(maybePathOrUrl: string): string {
  try {
    // already URL?
    new URL(maybePathOrUrl);
    return maybePathOrUrl;
  } catch {
    return pathToFileURL(resolve(process.cwd(), maybePathOrUrl)).toString();
  }
}
