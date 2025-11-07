import { Identity } from "../types/keys.js";
import { TokenDescriptor, Amount } from "../types/tokens.js";
import { Note } from "../types/core.js";
import { RelayerClient } from "../relayer/client.js";
import { buildNote } from "../notes/note.js";
import { commitmentOf } from "../notes/commitment.js";
import { tokenIdOf } from "../registry/tokenId.js";
import { generateDepositProof } from "../circuits/deposit/prover.js";
import { encodeDepositCallData, buildShieldedDepositIx } from "../chains/solana/anchor.js";
import { ensureUserAta } from "../chains/solana/token.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { wrapWSOLIfNeeded } from "../chains/solana/token.js";
import { TOKENS } from "../config/assets.js";

export interface DepositParams {
  identity: Identity;
  token: TokenDescriptor;
  amount: Amount;
  recipient?: bigint; // defaults to identity.recipientCipherPayPubKey
  chainContext: {
    solana?: {
      connection: any;
      owner: PublicKey; // user wallet
      payer: PublicKey; // usually same as owner (wallet adapters ignore)
      mint: PublicKey;

      programId: PublicKey;
      vaultAuthorityPda: PublicKey;

      // Optional overrides (ATA derivations)
      userTokenAta?: PublicKey;
      vaultTokenAta?: PublicKey;

      send: (tx: Transaction) => Promise<string>;
    };
    // evm omitted here
  };
  relayer: RelayerClient;
}

export interface DepositResult {
  commitment: bigint;
  index?: number;
  merkleRoot?: bigint;
  txId?: string;
  proofSubmitted?: boolean;
}

export async function deposit(params: DepositParams): Promise<DepositResult> {
  if (!params.chainContext.solana) throw new Error("Solana context required for SPL deposit");
  const { solana } = params.chainContext;

  // 1) Build note & commitment
  const ownerCipher = params.recipient ?? params.identity.recipientCipherPayPubKey;
  const tokenId = await tokenIdOf(params.token);
  const note: Note = buildNote({
    amount: params.amount.atoms,
    tokenId,
    ownerCipherPayPubKey: ownerCipher,
    memo: undefined,
  });
  const commitment = await commitmentOf(note);

  // 2) Fetch Merkle root snapshot (prove-first design)
  const { root: merkleRoot, nextIndex } = await params.relayer.getRoot();

  // 3) Prover input (align with your deposit.circom signals)
  const depositInput = {
    amount: note.amount.toString(),
    tokenId: note.tokenId.toString(),
    ownerCipherPayPubKey: note.ownerCipherPayPubKey.toString(),
    r: note.randomness.r.toString(),
    s: (note.randomness.s ?? 0n).toString(),
    merkleRoot: merkleRoot.toString(),
    leafIndex: String(nextIndex),
    siblings: [],              // deposit may not require path; if it does, fetch from relayer
    depositHash: "0"           // fill if your circuit requires
  };

  const { proof, publicSignals } = await generateDepositProof(depositInput);

  // 4) Ensure ATAs
  const userAta = solana.userTokenAta ?? await ensureUserAta(
    solana.connection, solana.payer, solana.owner, solana.mint, solana.send
  );
  // Derive vault ATA (program authority as owner)
  const vaultAta = solana.vaultTokenAta ?? PublicKey.findProgramAddressSync(
    [
      solana.vaultAuthorityPda.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      solana.mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0]; // PDA address of ATA; on-chain CPI should init if missing

  // 5) Pack call data (discriminator + BORSH)
  // Convert public signals to bigint
  const ps = {
    amount: BigInt(publicSignals.amount as any),
    depositHash: BigInt(publicSignals.depositHash as any),
    newCommitment: BigInt(publicSignals.newCommitment as any),
    ownerCipherPayPubKey: BigInt(publicSignals.ownerCipherPayPubKey as any),
    merkleRoot: BigInt(publicSignals.merkleRoot as any),
    nextLeafIndex: Number(publicSignals.nextLeafIndex as any),
  };

  const data = encodeDepositCallData({
    proof,
    amount: ps.amount,
    depositHash: ps.depositHash,
    newCommitment: ps.newCommitment,
    ownerCipherPayPubKey: ps.ownerCipherPayPubKey,
    merkleRoot: ps.merkleRoot,
    nextLeafIndex: ps.nextLeafIndex,
    // method: "shielded_deposit" // if your method name differs, set it here
  });

  const isWSOL = solana.mint.toBase58() === TOKENS.WSOL.solana!.mint;
  if (isWSOL) {
  // ensure user has at least `amount.atoms` WSOL
    await wrapWSOLIfNeeded(
        solana.connection,
        solana.owner,
        Number(params.amount.atoms), // atoms = lamports for WSOL
        solana.payer,
        solana.send
    );
}

  // 6) Build IX & send
  const ix = buildShieldedDepositIx({
    programId: solana.programId,
    accounts: {
      payer: solana.payer,
      user: solana.owner,
      userTokenAta: userAta,
      vaultAuthorityPda: solana.vaultAuthorityPda,
      vaultTokenAta: vaultAta,
      mint: solana.mint,

      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    },
    data,
  });

  const tx = new Transaction().add(ix);
  const txId = await solana.send(tx);

  // 7) (Option A) Optimistic: return publicSignals; relayer should consume event and append
  // (Option B) Append via relayer now (until program emits & relayer listens)
  // const appended = await params.relayer.appendCommitment(commitment);

  return {
    commitment,
    index: ps.nextLeafIndex,
    merkleRoot: ps.merkleRoot,
    txId,
    proofSubmitted: true,
  };
}
