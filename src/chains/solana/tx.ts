import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

/** Generic signature for the SDK's `send(tx)` dependency */
export type SendTx = (tx: Transaction | VersionedTransaction) => Promise<string>;

/** Browser wallet (Phantom/Backpack) adapter shape we need */
export interface WalletAdapterLike {
  publicKey: PublicKey | null;
  signTransaction(tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction>;
  sendTransaction?(tx: Transaction | VersionedTransaction, connection: Connection, opts?: { skipPreflight?: boolean }): Promise<string>;
}

/**
 * Create a `send(tx)` for browser wallets.
 * - If the adapter exposes `sendTransaction`, we use it directly (best UX).
 * - Else we `signTransaction` then `sendRawTransaction`.
 */
export function createWalletSend(connection: Connection, wallet: WalletAdapterLike, opts?: { skipPreflight?: boolean }): SendTx {
  return async (tx: Transaction | VersionedTransaction) => {
    // populate recent blockhash & fee payer when needed (legacy Transaction path)
    if (tx instanceof Transaction) {
      if (!tx.feePayer && wallet.publicKey) tx.feePayer = wallet.publicKey;
      if (!tx.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
      }
    }

    if (wallet.sendTransaction) {
      return await wallet.sendTransaction(tx, connection, { skipPreflight: opts?.skipPreflight });
    }

    const signed = await wallet.signTransaction(tx);
    const raw = signed.serialize();
    return await connection.sendRawTransaction(raw, { skipPreflight: opts?.skipPreflight });
  };
}

/** Create a `send(tx)` using a Node `Keypair` (for scripts / servers). */
export function createKeypairSend(connection: Connection, signer: Keypair, opts?: { skipPreflight?: boolean }): SendTx {
  return async (tx: Transaction | VersionedTransaction) => {
    if (tx instanceof Transaction) {
      tx.feePayer = signer.publicKey;
      if (!tx.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
      }
      tx.sign(signer);
      const raw = tx.serialize();
      return await connection.sendRawTransaction(raw, { skipPreflight: opts?.skipPreflight });
    }

    // Versioned path: sign with v0 signer if caller constructed it
    // @ts-ignore - VersionedTransaction has .sign
    tx.sign([signer]);
    // @ts-ignore
    const raw = tx.serialize();
    return await connection.sendRawTransaction(raw, { skipPreflight: opts?.skipPreflight });
  };
}
