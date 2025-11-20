import { RelayerAPI } from "./api.js";
import { MerklePath } from "../types/core.js";
import { Commitment } from "../types/core.js";

export class RelayerClient implements RelayerAPI {
  constructor(private baseUrl: string, private token?: string) {}

  getBaseUrl(): string { return this.baseUrl; }

  setAuth(token: string) { this.token = token; }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (this.token) h.authorization = `Bearer ${this.token}`;
    return h;
  }

  // Get relayer info (pubkey, etc.)
  async getRelayerInfo(): Promise<{ relayerPubkey: string }> {
    const r = await fetch(`${this.baseUrl}/api/v1/relayer/info`, { headers: this.headers() });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Relayer getRelayerInfo failed: ${r.status} ${txt}`);
    }
    return await r.json();
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

  // Prepare deposit: get merkle path for commitment
  async prepareDeposit(commitment: string | bigint): Promise<{
    merkleRoot: string; // BE hex(32)
    nextLeafIndex: number;
    inPathElements: string[]; // BE hex bottom→top
    inPathIndices: number[]; // 0/1 bits
  }> {
    const r = await fetch(`${this.baseUrl}/api/v1/prepare/deposit`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ commitment: commitment.toString() })
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Relayer prepareDeposit failed: ${r.status} ${txt}`);
    }
    return await r.json();
  }

  // Submit deposit: send proof and public signals to relayer
  async submitDeposit(params: {
    amount: number | bigint;
    tokenMint: string;
    proof: any;
    publicSignals: string[];
    depositHash?: string;
    commitment?: string;
    memo?: number | bigint;
    sourceOwner?: string;
    sourceTokenAccount?: string;
    useDelegate?: boolean;
  }): Promise<{ ok: boolean; signature?: string; txid?: string; txSig?: string }> {
    const body: any = {
      operation: "deposit",
      amount: Number(params.amount),
      tokenMint: params.tokenMint,
      proof: params.proof,
      publicSignals: params.publicSignals,
    };
    if (params.depositHash) body.depositHash = params.depositHash;
    if (params.commitment) body.commitment = params.commitment;
    if (params.memo !== undefined) body.memo = Number(params.memo);
    if (params.sourceOwner) body.sourceOwner = params.sourceOwner;
    if (params.sourceTokenAccount) body.sourceTokenAccount = params.sourceTokenAccount;
    if (params.useDelegate !== undefined) body.useDelegate = params.useDelegate;

    const r = await fetch(`${this.baseUrl}/api/v1/submit/deposit`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Relayer submitDeposit failed: ${r.status} ${txt}`);
    }
    return await r.json();
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
