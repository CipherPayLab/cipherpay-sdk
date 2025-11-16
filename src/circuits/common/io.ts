import { CircuitArtifacts } from "./types.js";

// Browser-compatible artifact loading
const isBrowser = typeof window !== 'undefined' || typeof globalThis.window !== 'undefined';

/** Load artifacts.json sitting next to wasm/zkey files */
export async function loadArtifacts(artifactsJsonUrl: string): Promise<CircuitArtifacts> {
  if (isBrowser) {
    // Browser: use fetch to load the JSON file
    // artifactsJsonUrl will be an import.meta.url path, convert to public path
    const response = await fetch('/circuits/deposit/artifacts.json');
    if (!response.ok) {
      throw new Error(`Failed to load artifacts: ${response.status}`);
    }
    const parsed = await response.json() as CircuitArtifacts;
    
    // Strip leading ./ from paths and return absolute paths
    const cleanPath = (path: string) => path.replace(/^\.\//, '');
    
    return {
      wasm: `/circuits/deposit/${cleanPath(parsed.wasm)}`,
      zkey: `/circuits/deposit/${cleanPath(parsed.zkey)}`,
      vkey: parsed.vkey ? `/circuits/deposit/${cleanPath(parsed.vkey)}` : undefined
    };
  } else {
    // Node.js: use dynamic imports for node modules
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath, pathToFileURL } = await import("node:url");
    const { dirname, resolve } = await import("node:path");
    
    const url = await toURL(artifactsJsonUrl);
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
}

export async function loadJSON<T = unknown>(fileUrl: string): Promise<T> {
  if (isBrowser) {
    // Browser: use fetch
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to load JSON: ${response.status}`);
    }
    return await response.json() as T;
  } else {
    // Node.js: use fs
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const buf = await readFile(fileURLToPath(fileUrl), "utf8");
    return JSON.parse(buf) as T;
  }
}

async function toURL(maybePathOrUrl: string): Promise<string> {
  try {
    // already URL?
    new URL(maybePathOrUrl);
    return maybePathOrUrl;
  } catch {
    const { pathToFileURL } = await import("node:url");
    const { resolve } = await import("node:path");
    return pathToFileURL(resolve(process.cwd(), maybePathOrUrl)).toString();
  }
}
