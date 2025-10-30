import { Commitment, MerklePath } from "./core.js";

export interface RelayerAppendResponse {
  commitment: Commitment;
  index: number;
  merkleRoot: bigint;
}

export interface RelayerProofRequest { commitment: Commitment; }
export interface RelayerProofResponse { path: MerklePath; exists: boolean; }

export type StreamEventType = "DepositCompleted" | "TransferCompleted" | "WithdrawCompleted";

export interface StreamEvent {
  type: StreamEventType;
  commitment: Commitment;
  index: number;
  merkleRoot: bigint;
  timestamp: number;
}
