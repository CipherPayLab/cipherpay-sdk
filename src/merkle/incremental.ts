import { poseidonN } from "../utils/crypto.js";

export class IncrementalMerkle {
  readonly depth: number;
  leaves: (bigint | null)[] = [];
  constructor(depth = 20) { this.depth = depth; }

  async appendLeaf(c: bigint) { this.leaves.push(c); }
  async root(): Promise<bigint> {
    let level = this.leaves.slice();
    for (let d = 0; d < this.depth; d++) {
      const next: bigint[] = [];
      for (let i = 0; i < Math.ceil(level.length / 2); i++) {
        const L = level[2*i] ?? 0n;
        const R = level[2*i+1] ?? 0n;
        next.push(await poseidonN([L as bigint, R as bigint]));
      }
      level = next;
    }
    return level[0] ?? 0n;
  }

  /** Return sibling list for index */
  async proof(index: number): Promise<bigint[]> {
    const sibs: bigint[] = [];
    let idx = index;
    let level = this.leaves.slice();
    for (let d = 0; d < this.depth; d++) {
      const sibling = idx ^ 1;
      sibs.push((level[sibling] ?? 0n) as bigint);
      // build parents
      const parents: (bigint | null)[] = [];
      for (let i = 0; i < Math.ceil(level.length/2); i++) {
        const L = (level[2*i] ?? 0n) as bigint;
        const R = (level[2*i+1] ?? 0n) as bigint;
        parents.push(await poseidonN([L, R]));
      }
      level = parents;
      idx >>= 1;
    }
    return sibs;
  }
}
