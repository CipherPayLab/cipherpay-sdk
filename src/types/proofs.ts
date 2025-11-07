import { Field } from "./core.js";

export interface DepositPublicSignals {
  amount: Field;
  depositHash: Field;
  newCommitment: Field;
  ownerCipherPayPubKey: Field;
  merkleRoot: Field;
  nextLeafIndex: number;
}

export interface DepositProof {
  proof: unknown;
  publicSignals: DepositPublicSignals;
}

// TODO: fill out when you lock transfer/withdraw IO
export interface TransferProof { proof: unknown; publicSignals: Record<string, Field | number>; }
export interface WithdrawProof { proof: unknown; publicSignals: Record<string, Field | number>; }
