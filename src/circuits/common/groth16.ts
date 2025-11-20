import { groth16 } from "snarkjs";
import { ProveResult } from "./types.js";

/**
 * Run Groth16 proving with given witness input object.
 * @param wasmUrl file:// URL to wasm
 * @param zkeyUrl file:// URL to zkey
 * @param input  the witness JSON object matching circuit signals
 */
export async function prove<TPublicSignals = unknown>(
  wasmUrl: string,
  zkeyUrl: string,
  input: Record<string, unknown>
): Promise<ProveResult<TPublicSignals>> {
  const isBrowser = typeof window !== 'undefined' || typeof globalThis.window !== 'undefined';
  
  if (isBrowser) {
    // In browser: use groth16.fullProve which handles witness generation + proving
    // It expects the wasm URL and zkey URL directly
    // Note: fullProve exists at runtime but may not be in type definitions
    const { proof, publicSignals } = await (groth16 as any).fullProve(
      input,
      wasmUrl,
      zkeyUrl
    );
    return { proof, publicSignals: publicSignals as TPublicSignals };
  } else {
    // In Node.js: use file paths with groth16.prove
    const wasmPath = await fileUrlToPathOrUrl(wasmUrl);
    const zkeyPath = await fileUrlToPathOrUrl(zkeyUrl);
    const { proof, publicSignals } = await (groth16 as any).prove(wasmPath, zkeyPath, input);
    return { proof, publicSignals: publicSignals as TPublicSignals };
  }
}

/** Verify a Groth16 proof using a vkey JSON object */
export async function verify(
  vkey: unknown,
  publicSignals: unknown,
  proof: unknown
): Promise<boolean> {
  return await groth16.verify(vkey, publicSignals, proof);
}

async function fileUrlToPathOrUrl(u: string): Promise<string> {
  // In browser environment, just return the URL as-is
  if (typeof window !== 'undefined' || typeof globalThis.window !== 'undefined') {
    return u;
  }
  
  // In Node.js/Deno, convert file:// URLs to paths
  if (u.startsWith("file://")) {
    try {
      const { fileURLToPath } = await import("node:url");
      return fileURLToPath(u);
    } catch (e) {
      // Fallback: just return the URL
      return u;
    }
  }
  return u;
}
