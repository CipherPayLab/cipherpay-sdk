import { Identity } from "../types/keys.js";
import { TokenDescriptor, Amount } from "../types/tokens.js";
import { Note } from "../types/core.js";
import { RelayerClient } from "../relayer/client.js";
import { buildNote } from "../notes/note.js";
import { commitmentOf } from "../notes/commitment.js";
import { tokenIdOf } from "../registry/tokenId.js";
import { generateDepositProof } from "../circuits/deposit/prover.js";
import { poseidonHash } from "../crypto/poseidon.js";
import { ensureUserAta } from "../chains/solana/token.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  approveChecked,
  getMint,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { wrapWSOLIfNeeded } from "../chains/solana/token.js";
import { TOKENS } from "../config/assets.js";

export interface DepositParams {
  identity: Identity;
  token: TokenDescriptor;
  amount: Amount;
  recipient?: bigint; // defaults to identity.recipientCipherPayPubKey
  memo?: bigint;
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
  
  // For delegate-based deposits (matching test pattern)
  useDelegate?: boolean;
  // Solana wallet keys as bigints (for circuit inputs)
  ownerWalletPubKey?: bigint;
  ownerWalletPrivKey?: bigint;
  // Nonce for depositHash computation
  nonce?: bigint;
}

export interface DepositResult {
  commitment: bigint;
  index?: number;
  merkleRoot?: bigint;
  txId?: string;
  proofSubmitted?: boolean;
  signature?: string;
}

// Field modulus for BN254
const FQ = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function normalizeHex(h: string): string {
  return (h.startsWith("0x") ? h.slice(2) : h).toLowerCase();
}

function beHexToBig(h: string): bigint {
  return BigInt("0x" + normalizeHex(h));
}

function fromHexToBigBE(s: string): bigint {
  const t = s.startsWith("0x") ? s.slice(2) : s;
  return BigInt("0x" + t) % FQ;
}

function hex64(bi: bigint): string {
  return bi.toString(16).padStart(64, "0");
}

function feFromIndex(idx: number): bigint {
  return BigInt(idx) % FQ;
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
    memo: params.memo,
  });
  
  // Compute commitment: H(amount, ownerCipherPayPubKey, randomness, tokenId, memo)
  const commitment = await commitmentOf(note);

  // 2) Prepare deposit: get merkle path from relayer
  const prep = await params.relayer.prepareDeposit(commitment);
  
  // 3) Compute depositHash and other values needed for proof
  // If ownerWalletPubKey/PrivKey provided, use them; otherwise derive from identity
  const ownerWalletPubKey = params.ownerWalletPubKey ?? BigInt(0);
  const ownerWalletPrivKey = params.ownerWalletPrivKey ?? BigInt(0);
  const nonce = params.nonce ?? feFromIndex(0);
  
  // depositHash = H(ownerCipherPayPubKey, amount, nonce)
  const depositHash = await poseidonHash([
    ownerCipher,
    params.amount.atoms,
    nonce
  ]);

  // 4) Build circuit inputs (matching test pattern)
  const inputSignals = {
    ownerWalletPubKey: ownerWalletPubKey.toString(),
    ownerWalletPrivKey: ownerWalletPrivKey.toString(),
    randomness: note.randomness.r.toString(),
    tokenId: tokenId.toString(),
    memo: (params.memo ?? 0n).toString(),
    amount: params.amount.atoms.toString(),
    nonce: nonce.toString(),

    inPathElements: prep.inPathElements.map((h) =>
      fromHexToBigBE(h).toString()
    ),
    inPathIndices: prep.inPathIndices,
    nextLeafIndex: prep.nextLeafIndex.toString(),

    oldMerkleRoot: beHexToBig(prep.merkleRoot).toString(),
    depositHash: depositHash.toString(),
  } as any;

  // 5) Generate proof
  const { proof, publicSignals } = await generateDepositProof(inputSignals as any);

  // 6) Ensure user ATA exists and has tokens
  const userAta = solana.userTokenAta ?? await ensureUserAta(
    solana.connection, solana.payer, solana.owner, solana.mint, solana.send
  );

  // 7) Handle delegate approval if needed
  if (params.useDelegate) {
    // Get relayer pubkey
    const info = await params.relayer.getRelayerInfo();
    const relayerPk = new PublicKey(info.relayerPubkey);

    // Get mint decimals
    const mintInfo = await getMint(solana.connection, solana.mint);
    
    // Approve relayer as delegate
    const allowance = params.amount.atoms;
    // Note: approveChecked expects owner as Signer, but in browser context we use wallet adapter
    // The transaction will be signed by the wallet adapter when sent
    await approveChecked(
      solana.connection,
      solana.payer as any,
      solana.mint,
      userAta,
      relayerPk,
      solana.owner as any,
      allowance,
      mintInfo.decimals
    );
  }

  // 8) Wrap SOL to WSOL if needed
  const isWSOL = solana.mint.toBase58() === TOKENS.WSOL.solana!.mint;
  if (isWSOL) {
    await wrapWSOLIfNeeded(
      solana.connection,
      solana.owner,
      Number(params.amount.atoms),
      solana.payer,
      solana.send
    );
  }

  // 9) Format hex values for submission
  const commitmentHex = hex64(commitment);
  const depHashHex = hex64(depositHash);
  
  // Use public signals if available (they may have normalized values)
  let finalCommitmentHex = commitmentHex;
  let finalDepHashHex = depHashHex;
  if (publicSignals && Array.isArray(publicSignals) && publicSignals.length >= 7) {
    try {
      finalCommitmentHex = BigInt(publicSignals[0]).toString(16).padStart(64, "0");
      finalDepHashHex = BigInt(publicSignals[5]).toString(16).padStart(64, "0");
    } catch (e) {
      // Fall back to computed values
    }
  }

  // 10) Submit deposit to relayer
  const submitResult = await params.relayer.submitDeposit({
    amount: params.amount.atoms,
    tokenMint: solana.mint.toBase58(),
    proof,
    publicSignals: Array.isArray(publicSignals) ? publicSignals.map((s: any) => String(s)) : Object.values(publicSignals).map((s: any) => String(s)),
    depositHash: finalDepHashHex,
    commitment: finalCommitmentHex,
    memo: params.memo,
    sourceOwner: params.useDelegate ? solana.owner.toBase58() : undefined,
    sourceTokenAccount: params.useDelegate ? userAta.toBase58() : undefined,
    useDelegate: params.useDelegate,
  });

  return {
    commitment,
    index: prep.nextLeafIndex,
    merkleRoot: beHexToBig(prep.merkleRoot),
    txId: submitResult.signature || submitResult.txid || submitResult.txSig,
    proofSubmitted: true,
    signature: submitResult.signature || submitResult.txid || submitResult.txSig,
  };
}
