import { CircuitArtifacts } from "./types.js";

// Browser-compatible artifact loading
const isBrowser = typeof window !== 'undefined' || typeof globalThis.window !== 'undefined';

/** Load artifacts.json sitting next to wasm/zkey files */
export async function loadArtifacts(artifactsJsonUrl: string, circuitName?: string): Promise<CircuitArtifacts> {
  if (isBrowser) {
    // Browser: use fetch to load the JSON file
    // Try to extract circuit name from the URL if not provided
    let detectedCircuitName = circuitName;
    if (!detectedCircuitName) {
      // Try to extract from import.meta.url path (works in some bundlers)
      if (artifactsJsonUrl.includes('/circuits/')) {
        const match = artifactsJsonUrl.match(/\/circuits\/([^\/]+)\//);
        if (match) {
          detectedCircuitName = match[1];
        }
      }
      // Fallback to deposit if we can't determine
      if (!detectedCircuitName) {
        detectedCircuitName = 'deposit';
      }
    }
    
    const publicPath = `/circuits/${detectedCircuitName}/artifacts.json`;
    
    const response = await fetch(publicPath);
    if (!response.ok) {
      throw new Error(`Failed to load artifacts from ${publicPath}: ${response.status}`);
    }
    const parsed = await response.json() as CircuitArtifacts;
    
    // Strip leading ./ from paths and return absolute paths
    const cleanPath = (path: string) => path.replace(/^\.\//, '');
    
    return {
      wasm: `/circuits/${detectedCircuitName}/${cleanPath(parsed.wasm)}`,
      zkey: `/circuits/${detectedCircuitName}/${cleanPath(parsed.zkey)}`,
      vkey: parsed.vkey ? `/circuits/${detectedCircuitName}/${cleanPath(parsed.vkey)}` : undefined
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
