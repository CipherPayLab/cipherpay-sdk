import { Commitment, MerklePath } from "../types/core.js";

export interface RelayerAPI {
  // Returns the current canonical root snapshot (and next index if useful).
  getRoot(): Promise<{ root: bigint; nextIndex: number }>;

  // Append a new commitment; relayer recomputes root and assigns index.
  appendCommitment(commitment: Commitment): Promise<{ index: number; root: bigint }>;

  // Returns a Merkle path for an existing leaf (by index or commitment).
  getProofByIndex(index: number): Promise<MerklePath>;
  getProofByCommitment(commitment: Commitment): Promise<MerklePath>;

  // Stream canonical events (server-sent or WS). Returns unsubscribe.
  streamEvents(onEvent: (ev: {
    type: "DepositCompleted" | "TransferCompleted" | "WithdrawCompleted";
    commitment: Commitment;
    index: number;
    merkleRoot: bigint;
    timestamp: number;
  }) => void): () => void;
}
