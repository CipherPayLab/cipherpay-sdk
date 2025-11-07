import { RelayerAPI } from "./api.js";
import { Commitment, MerklePath } from "../types/core.js";
import { poseidon2 } from "../utils/crypto.js";

export class InMemoryRelayer implements RelayerAPI {
  private leaves: bigint[] = [];
  private _root: bigint = 0n;       // zero-root for empty tree
  private listeners: Set<(e: any) => void> = new Set();

  constructor(private depth = 20) {
    this._root = 0n;
  }

  async getRoot(): Promise<{ root: bigint; nextIndex: number }> {
    return { root: this._root, nextIndex: this.leaves.length };
  }

  async appendCommitment(commitment: Commitment): Promise<{ index: number; root: bigint }> {
    const index = this.leaves.length;
    this.leaves.push(commitment);
    this._root = await this.recomputeRoot();
    const ev = {
      type: "DepositCompleted",
      commitment,
      index,
      merkleRoot: this._root,
      timestamp: Date.now()
    };
    this.listeners.forEach(l => l(ev));
    return { index, root: this._root };
  }

  async getProofByIndex(index: number): Promise<MerklePath> {
    if (index < 0 || index >= this.leaves.length) throw new Error("Index out of range");
    const leaf = this.leaves[index];
    const siblings = await this.buildSiblings(index);
    return { root: this._root, leaf, index, siblings };
  }

  async getProofByCommitment(commitment: Commitment): Promise<MerklePath> {
    const index = this.leaves.findIndex(x => x === commitment);
    if (index === -1) throw new Error("Commitment not found");
    return this.getProofByIndex(index);
  }

  streamEvents(onEvent: (ev: any) => void): () => void {
    this.listeners.add(onEvent);
    return () => this.listeners.delete(onEvent);
  }

  // --- internal helpers ---
  private async recomputeRoot(): Promise<bigint> {
    // naive: build levels bottom-up; pad with zeros to next power-of-two
    let level: bigint[] = this.padToPowerOfTwo(this.leaves);
    if (level.length === 0) return 0n;
    while (level.length > 1) {
      const next: bigint[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const L = level[i], R = level[i + 1] ?? 0n;
        next.push(await poseidon2([L, R]));
      }
      level = next;
    }
    return level[0];
  }

  private async buildSiblings(index: number): Promise<bigint[]> {
    let level: bigint[] = this.padToPowerOfTwo(this.leaves);
    const siblings: bigint[] = [];
    let idx = index;
    while (level.length > 1) {
      const isRight = idx % 2 === 1;
      const sib = level[isRight ? idx - 1 : idx + 1] ?? 0n;
      siblings.push(sib);
      // go up one level
      const next: bigint[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const L = level[i], R = level[i + 1] ?? 0n;
        next.push(await poseidon2([L, R]));
      }
      idx = Math.floor(idx / 2);
      level = next;
    }
    return siblings;
  }

  private padToPowerOfTwo(arr: bigint[]): bigint[] {
    let n = 1;
    while (n < arr.length) n <<= 1;
    const out = arr.slice();
    while (out.length < n) out.push(0n);
    return out;
  }
}
