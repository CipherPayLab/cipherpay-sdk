import "isomorphic-fetch";
import { RelayerAPI } from "./api.js";
import { MerklePath } from "../types/core.js";
import { Commitment } from "../types/core.js";

export class RelayerClient implements RelayerAPI {
  constructor(private baseUrl: string, private token?: string) {}

  setAuth(token: string) { this.token = token; }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (this.token) h.authorization = `Bearer ${this.token}`;
    return h;
  }

  async getRoot(): Promise<{ root: bigint; nextIndex: number }> {
    const r = await fetch(`${this.baseUrl}/root`, { headers: this.headers() });
    if (!r.ok) throw new Error(`Relayer getRoot failed: ${r.status}`);
    const j = await r.json() as { root: string; nextIndex: number };
    return { root: BigInt(j.root), nextIndex: j.nextIndex };
  }

  async appendCommitment(commitment: Commitment): Promise<{ index: number; root: bigint }> {
    const r = await fetch(`${this.baseUrl}/commitments`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ commitment: commitment.toString() })
    });
    if (!r.ok) throw new Error(`Relayer appendCommitment failed: ${r.status}`);
    const j = await r.json() as { index: number; root: string };
    return { index: j.index, root: BigInt(j.root) };
  }

  async getProofByIndex(index: number): Promise<MerklePath> {
    const r = await fetch(`${this.baseUrl}/merkle-proof?index=${index}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`Relayer getProofByIndex failed: ${r.status}`);
    const j = await r.json() as any;
    return normalizePath(j);
  }

  async getProofByCommitment(commitment: Commitment): Promise<MerklePath> {
    const r = await fetch(`${this.baseUrl}/merkle-proof?commitment=${commitment.toString()}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`Relayer getProofByCommitment failed: ${r.status}`);
    const j = await r.json() as any;
    return normalizePath(j);
  }

  streamEvents(onEvent: (e: any) => void): () => void {
    const ctrl = new AbortController();
    (async () => {
      const r = await fetch(`${this.baseUrl}/events`, { headers: this.headers(), signal: ctrl.signal });
      if (!r.ok || !r.body) throw new Error(`Relayer events failed: ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = dec.decode(value);
        for (const line of text.split("\n")) {
          const s = line.trim();
          if (!s) continue;
          try { onEvent(JSON.parse(s)); } catch {}
        }
      }
    })().catch(() => {});
    return () => ctrl.abort();
  }
}

function normalizePath(j: any): MerklePath {
  return {
    root: BigInt(j.root),
    leaf: BigInt(j.leaf),
    index: j.index,
    siblings: (j.siblings ?? []).map((x: string) => BigInt(x))
  };
}
