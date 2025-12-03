import { ProveResult } from "../common/types.js";
import { loadArtifacts, loadJSON } from "../common/io.js";
import { prove, verify as verifyGroth16 } from "../common/groth16.js";
import artifacts from "./artifacts.json" with { type: "json" };

export interface WithdrawPublicSignals {
  nullifier: string | bigint; 
  merkleRoot: string | bigint;
  amount: string | bigint;
  tokenId: string | bigint;
  recipientCipherPayPubKey?: string | bigint;
}

export interface WithdrawInput {
  // witness inputs expected by withdraw.circom
  [k: string]: unknown;
}

export async function generateWithdrawProof(input: WithdrawInput): Promise<ProveResult<WithdrawPublicSignals>> {
  const art = await loadArtifacts(import.meta.url.replace(/prover\.ts$/, "artifacts.json"), "withdraw");
  const out = await prove<WithdrawPublicSignals>(art.wasm, art.zkey, input as unknown as Record<string, unknown>);
  if (art.vkey) {
    const vkey = await loadJSON(art.vkey);
    const ok = await verifyGroth16(vkey, out.publicSignals, out.proof);
    if (!ok) throw new Error("Withdraw proof failed local verification");
  }
  return out;
}
