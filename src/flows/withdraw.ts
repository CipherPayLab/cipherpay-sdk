import { generateWithdrawProof } from "../circuits/withdraw/prover.js";
import { encodeWithdrawCallData, buildShieldedWithdrawIx } from "../chains/solana/anchor.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SystemProgram, Transaction, PublicKey } from "@solana/web3.js";
import { ensureUserAta } from "../chains/solana/token.js";

export async function withdraw(params: {
  solana: {
    connection: any;
    programId: PublicKey;
    payer: PublicKey;
    owner: PublicKey;
    mint: PublicKey;
    vaultAuthorityPda: PublicKey;
    send: (tx: Transaction) => Promise<string>;
  };
  input: { witness: Record<string, unknown> };
}) {
  const { proof, publicSignals } = await generateWithdrawProof(params.input.witness);

  // ensure user ATA to receive wSOL
  const userAta = await ensureUserAta(
    params.solana.connection,
    params.solana.payer,
    params.solana.owner,
    params.solana.mint,
    params.solana.send
  );

  // derive vault ATA (program may init_if_needed)
  const vaultAta = getAssociatedTokenAddressSync(
    params.solana.mint, params.solana.vaultAuthorityPda, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const data = encodeWithdrawCallData({
    proof,
    amount: BigInt(publicSignals.amount as any),
    nullifier: BigInt(publicSignals.nullifier as any),
    merkleRoot: BigInt(publicSignals.merkleRoot as any),
  });

  const ix = buildShieldedWithdrawIx({
    programId: params.solana.programId,
    accounts: {
      payer: params.solana.payer,
      user: params.solana.owner,
      userTokenAta: userAta,
      vaultAuthorityPda: params.solana.vaultAuthorityPda,
      vaultTokenAta: vaultAta,
      mint: params.solana.mint,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    },
    data,
  });

  const tx = new Transaction().add(ix);
  const sig = await params.solana.send(tx);
  return { txId: sig };
}
