import { RelayerClient } from "../relayer/client.js";
import { generateTransferProof } from "../circuits/transfer/prover.js";
import { encodeTransferCallData, buildShieldedTransferIx } from "../chains/solana/anchor.js";
import { Transaction } from "@solana/web3.js";

export async function transfer(params: {
  relayer: RelayerClient;
  solana: {
    programId: any;
    payer: any;
    send: (tx: Transaction) => Promise<string>;
  };
  input: {
    // whatever your transfer.circom needs: old note data, new note fields, path, etc.
    witness: Record<string, unknown>;
  };
}) {
  const { proof, publicSignals } = await generateTransferProof(params.input.witness);

  const data = encodeTransferCallData({
    proof,
    oldNullifier: BigInt(publicSignals.nullifier as any),
    newCommitment: BigInt(publicSignals.newCommitment as any),
    merkleRoot: BigInt(publicSignals.merkleRoot as any),
  });

  const ix = buildShieldedTransferIx({
    programId: params.solana.programId,
    accounts: { payer: params.solana.payer },
    data,
  });

  const tx = new Transaction().add(ix);
  const sig = await params.solana.send(tx);
  return { txId: sig, newCommitment: BigInt(publicSignals.newCommitment as any) };
}
