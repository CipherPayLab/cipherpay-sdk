// src/merkle/cache.ts
import { MerklePath } from "../types/core";

export interface MerkleCache {
  latestRoot(): bigint | undefined;
  upsertLeaf(index: number, commitment: bigint): void;
  getPath(index: number): MerklePath | undefined; // local attempt
}
