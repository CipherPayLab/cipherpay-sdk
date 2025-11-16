// Delegate approval for relayer-based deposits
// This is a ONE-TIME setup that allows the relayer to pull tokens from user's ATA

import {
  createApproveCheckedInstruction,
  getMint,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

export interface ApproveRelayerDelegateParams {
  connection: Connection;
  wallet: {
    publicKey: PublicKey;
    sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>;
  };
  tokenMint: PublicKey;
  relayerPubkey: PublicKey;
  amount: bigint;
}

export interface ApproveRelayerDelegateResult {
  signature: string;
  userTokenAccount: PublicKey;
}

/**
 * Approves the relayer as a delegate for the user's token account.
 * This is a ONE-TIME operation that must be done before any deposits.
 * 
 * After approval, the relayer can pull tokens from the user's ATA up to the approved amount.
 * 
 * @param params - Configuration for delegate approval
 * @returns Transaction signature and user's token account address
 */
export async function approveRelayerDelegate(
  params: ApproveRelayerDelegateParams
): Promise<ApproveRelayerDelegateResult> {
  const { connection, wallet, tokenMint, relayerPubkey, amount } = params;

  console.log('[approveRelayerDelegate] Starting delegate approval...');
  console.log('[approveRelayerDelegate] Token mint:', tokenMint.toBase58());
  console.log('[approveRelayerDelegate] Relayer pubkey:', relayerPubkey.toBase58());
  console.log('[approveRelayerDelegate] Amount:', amount.toString());

  // Get mint info for decimals
  const mintInfo = await getMint(connection, tokenMint);
  console.log('[approveRelayerDelegate] Token decimals:', mintInfo.decimals);

  // Derive user's associated token account
  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    wallet.publicKey
  );
  console.log('[approveRelayerDelegate] User token account:', userTokenAccount.toBase58());

  // Create approve instruction
  const approveInstruction = createApproveCheckedInstruction(
    userTokenAccount,        // source (user's ATA)
    tokenMint,               // mint
    relayerPubkey,           // delegate (relayer)
    wallet.publicKey,        // owner (user wallet)
    amount,                  // amount to approve
    mintInfo.decimals        // decimals
  );

  // Build and send transaction
  const transaction = new Transaction().add(approveInstruction);
  
  console.log('[approveRelayerDelegate] Sending transaction...');
  const signature = await wallet.sendTransaction(transaction, connection);
  
  console.log('[approveRelayerDelegate] Transaction sent:', signature);
  console.log('[approveRelayerDelegate] Confirming...');
  
  // Wait for confirmation
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature,
    ...latestBlockhash,
  }, 'confirmed');

  console.log('[approveRelayerDelegate] Transaction confirmed!');
  console.log('[approveRelayerDelegate] Relayer can now pull up to', amount.toString(), 'tokens from your account');

  return {
    signature,
    userTokenAccount,
  };
}

/**
 * Revokes the relayer's delegate permission.
 * After revocation, the relayer can no longer pull tokens from the user's ATA.
 * 
 * @param params - Configuration (same as approve, but amount is ignored)
 * @returns Transaction signature
 */
export async function revokeRelayerDelegate(
  params: Omit<ApproveRelayerDelegateParams, 'amount'>
): Promise<string> {
  const { connection, wallet, tokenMint, relayerPubkey } = params;

  console.log('[revokeRelayerDelegate] Revoking delegate approval...');

  const mintInfo = await getMint(connection, tokenMint);
  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    wallet.publicKey
  );

  // Approve with amount 0 revokes the delegation
  const revokeInstruction = createApproveCheckedInstruction(
    userTokenAccount,
    tokenMint,
    relayerPubkey,
    wallet.publicKey,
    0n, // amount 0 = revoke
    mintInfo.decimals
  );

  const transaction = new Transaction().add(revokeInstruction);
  const signature = await wallet.sendTransaction(transaction, connection);

  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature,
    ...latestBlockhash,
  }, 'confirmed');

  console.log('[revokeRelayerDelegate] Delegate permission revoked:', signature);

  return signature;
}

