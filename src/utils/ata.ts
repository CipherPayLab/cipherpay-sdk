// src/utils/ata.ts
//
// Reusable ATA helpers for CipherPay SDK
// - Derive deterministic ATA addresses (legacy + Token-2022)
// - Build "create ATA" instructions (no signing here; wallet/dApp signs)
// - Ensure ATA exists (returns an instruction if missing)
// - Batch ensure for many (mint, owner) pairs
// - Wrap/unwrap SOL using the Native mint with ATA (So111...)
//   (returns instructions you can add to your transaction)
//
// Dependencies:
//   @solana/web3.js
//   @solana/spl-token >= 0.4.x
//
// Typical usage (client):
//   const { ata, ix } = await ensureAta(connection, payer, mint, owner);
//   const tx = new Transaction();
//   if (ix) tx.add(ix); // only if creation needed
//   // ... add your transfer ix here ...
//   await wallet.sendTransaction(tx, connection);

import {
    PublicKey,
    Connection,
    TransactionInstruction,
    SystemProgram,
  } from "@solana/web3.js";
  
  import {
    // Common program IDs
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
  
    // Native mints
    NATIVE_MINT,
    NATIVE_MINT_2022,
  
    // ATA helpers
    getAssociatedTokenAddress,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
  
    // SPL Token account utils & ixs
    getAccount,
    createSyncNativeInstruction,
    createCloseAccountInstruction,
  } from "@solana/spl-token";
  
  /** Small typed bundle to keep program IDs explicit & swappable. */
  export type ProgramIds = {
    tokenProgramId: PublicKey;        // TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID
    ataProgramId: PublicKey;          // ASSOCIATED_TOKEN_PROGRAM_ID (same program supports both)
  };
  
  /** Defaults for legacy SPL-Token (most mints today). */
  export const DEFAULT_PROGRAM_IDS: ProgramIds = {
    tokenProgramId: TOKEN_PROGRAM_ID,
    ataProgramId: ASSOCIATED_TOKEN_PROGRAM_ID,
  };
  
  /** Defaults for Token-2022 mints (extensions, transfer hooks, etc.). */
  export const DEFAULT_PROGRAM_IDS_2022: ProgramIds = {
    tokenProgramId: TOKEN_2022_PROGRAM_ID,
    ataProgramId: ASSOCIATED_TOKEN_PROGRAM_ID,
  };
  
  /** Quick discriminator for native mints. */
  export function isNativeMint(mint: PublicKey, pids: ProgramIds = DEFAULT_PROGRAM_IDS) {
    // Compare against both native constants since caller might mix program IDs accidentally.
    return mint.equals(NATIVE_MINT) || mint.equals(NATIVE_MINT_2022);
  }
  
  /** Derive the canonical ATA (async). */
  export async function deriveAta(
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve = false,
    pids: ProgramIds = DEFAULT_PROGRAM_IDS
  ): Promise<PublicKey> {
    return getAssociatedTokenAddress(
      mint,
      owner,
      allowOwnerOffCurve,
      pids.tokenProgramId,
      pids.ataProgramId
    );
  }
  
  /** Derive the canonical ATA (sync). */
  export function deriveAtaSync(
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve = false,
    pids: ProgramIds = DEFAULT_PROGRAM_IDS
  ): PublicKey {
    return getAssociatedTokenAddressSync(
      mint,
      owner,
      allowOwnerOffCurve,
      pids.tokenProgramId,
      pids.ataProgramId
    );
  }
  
  /** Lightweight existence check using raw account-info (fast, no SPL decode). */
  export async function ataExists(
    connection: Connection,
    ata: PublicKey
  ): Promise<boolean> {
    const info = await connection.getAccountInfo(ata);
    return !!info;
  }
  
  /** Build a single create-ATA instruction (no RPC checks). */
  export function buildCreateAtaIx(
    payer: PublicKey,
    mint: PublicKey,
    owner: PublicKey,
    pids: ProgramIds = DEFAULT_PROGRAM_IDS
  ): { ata: PublicKey; ix: TransactionInstruction } {
    const ata = deriveAtaSync(mint, owner, false, pids);
    const ix = createAssociatedTokenAccountInstruction(
      payer,
      ata,
      owner,
      mint,
      pids.tokenProgramId,
      pids.ataProgramId
    );
    return { ata, ix };
  }
  
  /**
   * Ensure an ATA exists for (mint, owner).
   * If it does not exist, returns a create-ATA instruction you can append to your tx.
   * If it already exists, returns { ata, ix: null }.
   */
  export async function ensureAta(
    connection: Connection,
    payer: PublicKey,
    mint: PublicKey,
    owner: PublicKey,
    pids: ProgramIds = DEFAULT_PROGRAM_IDS
  ): Promise<{ ata: PublicKey; ix: TransactionInstruction | null }> {
    const ata = await deriveAta(mint, owner, false, pids);
    if (await ataExists(connection, ata)) {
      return { ata, ix: null };
    }
    const { ix } = buildCreateAtaIx(payer, mint, owner, pids);
    return { ata, ix };
  }
  
  /**
   * Batch version of ensureAta for multiple (mint, owner) pairs.
   * Minimizes RPC round-trips by using getMultipleAccountsInfo under the hood.
   */
  export async function ensureAtas(
    connection: Connection,
    payer: PublicKey,
    pairs: Array<{ mint: PublicKey; owner: PublicKey; pids?: ProgramIds }>
  ): Promise<Array<{ ata: PublicKey; ix: TransactionInstruction | null }>> {
    // Precompute all ATAs
    const derived = pairs.map(({ mint, owner, pids }) => {
      const prog = pids ?? DEFAULT_PROGRAM_IDS;
      const ata = deriveAtaSync(mint, owner, false, prog);
      return { mint, owner, pids: prog, ata };
    });
  
    // Bulk existence check
    const infos = await connection.getMultipleAccountsInfo(derived.map(d => d.ata));
  
    // Build results
    return derived.map((d, i) => {
      const exists = !!infos[i];
      if (exists) return { ata: d.ata, ix: null };
      const ix = createAssociatedTokenAccountInstruction(
        payer,
        d.ata,
        d.owner,
        d.mint,
        d.pids.tokenProgramId,
        d.pids.ataProgramId
      );
      return { ata: d.ata, ix };
    });
  }
  
  /**
   * Returns the SPL-Token account data (owner, mint, amount, etc.) if present.
   * Throws if the account exists but is NOT a valid SPL token account for the given program.
   * Returns null if the account doesn't exist.
   */
  export async function tryGetSplAccount(
    connection: Connection,
    ata: PublicKey,
    tokenProgramId: PublicKey = TOKEN_PROGRAM_ID
  ) {
    const info = await connection.getAccountInfo(ata);
    if (!info) return null;
    // getAccount() validates layout against the provided token program
    return await getAccount(connection, ata, "confirmed", tokenProgramId);
  }
  
  /**
   * Build instructions to wrap SOL into its Native Token ATA (So111...),
   * optionally creating the ATA if it's missing.
   *
   * NOTE:
   *  - Transfers lamports from `payer` to the ATA via SystemProgram.transfer.
   *  - Then issues `syncNative` so the token amount matches lamports.
   *  - If you pass Token-2022 program IDs, it will still work (native mint constant differs),
   *    but most apps use legacy native mint + TOKEN_PROGRAM_ID.
   */
  export async function buildWrapSolIxs(
    connection: Connection,
    payer: PublicKey,
    amountLamports: bigint | number,
    owner: PublicKey = payer,
    pids: ProgramIds = DEFAULT_PROGRAM_IDS // typically legacy for native SOL
  ): Promise<{ ata: PublicKey; ixs: TransactionInstruction[] }> {
    const nativeMint =
      pids.tokenProgramId.equals(TOKEN_2022_PROGRAM_ID) ? NATIVE_MINT_2022 : NATIVE_MINT;
  
    const { ata, ix: maybeCreateAta } = await ensureAta(connection, payer, nativeMint, owner, pids);
  
    const ixs: TransactionInstruction[] = [];
    if (maybeCreateAta) ixs.push(maybeCreateAta);
  
    // fund ATA with lamports
    ixs.push(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: ata,
        lamports: typeof amountLamports === "bigint" ? Number(amountLamports) : amountLamports,
      })
    );
  
    // sync native so SPL balance == lamports
    ixs.push(createSyncNativeInstruction(ata, pids.tokenProgramId));
    return { ata, ixs };
  }
  
  /**
   * Build instruction to unwrap SOL from its Native Token ATA:
   *  - Closes the native ATA and sends lamports to `destination` (defaults to payer).
   *  - If ATA doesn't exist, returns an empty list.
   */
  export async function buildUnwrapSolIxs(
    connection: Connection,
    payer: PublicKey,
    destination?: PublicKey,
    owner: PublicKey = payer,
    pids: ProgramIds = DEFAULT_PROGRAM_IDS // typically legacy for native SOL
  ): Promise<{ ata: PublicKey; ixs: TransactionInstruction[] }> {
    const nativeMint =
      pids.tokenProgramId.equals(TOKEN_2022_PROGRAM_ID) ? NATIVE_MINT_2022 : NATIVE_MINT;
  
    const ata = deriveAtaSync(nativeMint, owner, false, pids);
    if (!(await ataExists(connection, ata))) {
      return { ata, ixs: [] }; // nothing to do
    }
  
    const ixs: TransactionInstruction[] = [
      createCloseAccountInstruction(
        ata,                       // native token ATA to close
        destination ?? payer,      // send lamports here
        owner,                     // ATA owner
        [],                        // multiSigners (unused for EOAs)
        pids.tokenProgramId
      ),
    ];
    return { ata, ixs };
  }
  
  /** Convenience: choose default program IDs based on whether a mint is Token-2022. */
  export function pickProgramsForMint(isToken2022: boolean): ProgramIds {
    return isToken2022 ? DEFAULT_PROGRAM_IDS_2022 : DEFAULT_PROGRAM_IDS;
  }
  
  /** Tiny guard for EOAs vs PDAs. Phantom EOAs should use allowOwnerOffCurve=false. */
  export function isOffCurveOwnerAllowed(owner: PublicKey, allowOwnerOffCurve: boolean): void {
    if (!allowOwnerOffCurve && owner.equals(PublicKey.default)) {
      throw new Error("Owner cannot be default PubKey when allowOwnerOffCurve=false.");
    }
    // (You could add additional checks here if you ever pass PDA owners.)
  }
  
  // ---------- Examples (for docs/tests) ----------
  // Example: ensure an ATA, then send tokens
  // const { ata, ix } = await ensureAta(connection, wallet.publicKey, mint, wallet.publicKey);
  // const tx = new Transaction();
  // if (ix) tx.add(ix);
  // tx.add(createTransferInstruction(ata, recipientAta, wallet.publicKey, amount, [], TOKEN_PROGRAM_ID));
  // await wallet.sendTransaction(tx, connection);
  