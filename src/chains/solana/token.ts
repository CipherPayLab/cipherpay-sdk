import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, Transaction, Signer } from "@solana/web3.js";

export async function ensureUserAta(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  send: (tx: Transaction, signers?: Signer[]) => Promise<string>
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(mint, owner, false);
  const info = await connection.getAccountInfo(ata);
  if (!info) {
    const ix = createAssociatedTokenAccountInstruction(payer, ata, owner, mint);
    await send(new Transaction().add(ix));
  }
  return ata;
}

export async function wrapSol(
  connection: Connection,
  owner: PublicKey,
  lamports: number,
  send: (tx: Transaction, signers?: Signer[]) => Promise<string>
): Promise<PublicKey> {
  const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
  const ata = getAssociatedTokenAddressSync(WSOL, owner);
  const info = await connection.getAccountInfo(ata);
  const tx = new Transaction();
  if (!info) {
    // If ATA missing, create it first via temp payer=owner (most wallets support it)
    // Users should call ensureUserAta beforehand in normal flow.
  }
  tx.add(
    SystemProgram.transfer({ fromPubkey: owner, toPubkey: ata, lamports }),
    createSyncNativeInstruction(ata)
  );
  await send(tx);
  return ata;
}

/**
 * Ensure the user's WSOL ATA exists and has at least `requiredLamports` worth of WSOL.
 * If the ATA doesn't exist, it will be created.
 * If the balance is insufficient, it will top-up by transferring native SOL into the ATA followed by SyncNative.
 *
 * @returns the WSOL ATA pubkey
 */
export async function wrapWSOLIfNeeded(
  connection: Connection,
  owner: PublicKey,
  requiredLamports: number, // amount in lamports of SOL to ensure in WSOL ATA
  payer: PublicKey,
  send: (tx: Transaction, signers?: Signer[]) => Promise<string>,
  wsolMint: PublicKey = new PublicKey("So11111111111111111111111111111111111111112")
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(wsolMint, owner, false);
  const ataInfo = await connection.getAccountInfo(ata);
  const tx = new Transaction();

  // If ATA missing, create it (payer funds rent)
  if (!ataInfo) {
    tx.add(createAssociatedTokenAccountInstruction(payer, ata, owner, wsolMint));
  }

  // Read current WSOL balance (0 if new)
  const tokenBal = await safeGetTokenAmount(connection, ata);

  if (tokenBal < requiredLamports) {
    const delta = requiredLamports - tokenBal;
    tx.add(
      SystemProgram.transfer({ fromPubkey: owner, toPubkey: ata, lamports: delta }),
      createSyncNativeInstruction(ata)
    );
  }

  if (tx.instructions.length > 0) {
    await send(tx);
  }
  return ata;
}

/** Helper: returns token amount (lamports) for a token account or 0 if missing/uninitialized */
async function safeGetTokenAmount(connection: Connection, tokenAccount: PublicKey): Promise<number> {
  const ai = await connection.getAccountInfo(tokenAccount);
  if (!ai) return 0;
  try {
    const res = await connection.getTokenAccountBalance(tokenAccount);
    // amount is string of raw units; WSOL has 9 decimals so 1 SOL = 1_000_000_000
    return Number(res.value.amount);
  } catch {
    return 0;
  }
}