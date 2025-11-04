// src/merkle/cache.ts
import { MerklePath } from "../types/core.js";

export interface MerkleCache {
  latestRoot(): bigint | undefined;
  upsertLeaf(index: number, commitment: bigint): void;
  getPath(index: number): MerklePath | undefined; // local attempt
}
