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
  // snarkjs supports URLs for fetch in ESM as long as it's a file:// that node can read
  const { proof, publicSignals } = await groth16.prove(fileUrlToPathOrUrl(wasmUrl), fileUrlToPathOrUrl(zkeyUrl), input);
  return { proof, publicSignals: publicSignals as TPublicSignals };
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
  // snarkjs accepts both file paths and URL strings; to be safe, convert file:// → path.
  if (u.startsWith("file://")) {
    const { fileURLToPath } = await import("node:url");
    return fileURLToPath(u);
  }
  return u;
}
