// Delegate approval for relayer-based deposits
// This is a ONE-TIME setup that allows the relayer to pull tokens from user's ATA

import {
  createApproveCheckedInstruction,
  getMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

export interface ApproveRelayerDelegateParams {
  connection: Connection;
  wallet: {
    publicKey: PublicKey;
    sendTransaction: (tx: Transaction, connection: Connection, options?: { skipPreflight?: boolean }) => Promise<string>;
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
  
  // Check wallet balance first
  const balance = await connection.getBalance(wallet.publicKey);
  console.log('[approveRelayerDelegate] Wallet balance:', balance, 'lamports');
  
  if (balance < 5000) {
    throw new Error(`Insufficient SOL for transaction fees. Need at least 0.000005 SOL (5000 lamports), have ${balance} lamports.`);
  }

  // Check if token account exists
  const accountInfo = await connection.getAccountInfo(userTokenAccount);
  const needsAtaCreation = !accountInfo;
  
  if (needsAtaCreation) {
    console.log('[approveRelayerDelegate] Token account does not exist, will create it in the same transaction');
  } else {
    console.log('[approveRelayerDelegate] Token account already exists');
  }

  // Create approve instruction
  const approveInstruction = createApproveCheckedInstruction(
    userTokenAccount,        // source (user's ATA)
    tokenMint,               // mint
    relayerPubkey,           // delegate (relayer)
    wallet.publicKey,        // owner (user wallet)
    amount,                  // amount to approve
    mintInfo.decimals        // decimals
  );

  // Build transaction - combine ATA creation and approval if needed
  const transaction = new Transaction();
  
  // Add ATA creation instruction first if needed
  if (needsAtaCreation) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        userTokenAccount,  // ATA address
        wallet.publicKey, // owner
        tokenMint         // mint
      )
    );
    console.log('[approveRelayerDelegate] Added ATA creation instruction');
  }
  
  // Add approval instruction
  transaction.add(approveInstruction);
  console.log('[approveRelayerDelegate] Added approval instruction');
  
  // Prepare transaction: set fee payer and recent blockhash
  // This is required before sending with wallet adapters
  transaction.feePayer = wallet.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  console.log('[approveRelayerDelegate] Transaction prepared, sending...');
  console.log('[approveRelayerDelegate] Fee payer:', wallet.publicKey.toBase58());
  console.log('[approveRelayerDelegate] Recent blockhash:', blockhash);
  console.log('[approveRelayerDelegate] Transaction instructions count:', transaction.instructions.length);
  
  let signature: string;
  try {
    // Send transaction - wallet adapter will handle signing
    signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: false,
    });
    
    console.log('[approveRelayerDelegate] Transaction sent:', signature);
    console.log('[approveRelayerDelegate] Confirming...');
    
    // Wait for confirmation
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    
    console.log('[approveRelayerDelegate] Transaction confirmed!');
    console.log('[approveRelayerDelegate] Relayer can now pull up to', amount.toString(), 'tokens from your account');
  } catch (error: any) {
    // Enhanced error logging
    console.error('[approveRelayerDelegate] Transaction send failed:', {
      error,
      errorType: error?.constructor?.name,
      errorMessage: error?.message || 'No error message',
      errorString: String(error),
      errorStack: error?.stack,
      walletType: wallet?.constructor?.name,
      transactionSize: transaction.serialize({ requireAllSignatures: false }).length,
    });
    
    // Re-throw with a more descriptive message
    const errorMsg = error?.message || error?.toString() || 'Unknown error';
    throw new Error(`Failed to send delegate approval transaction: ${errorMsg}`);
  }

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
  
  // Prepare transaction: set fee payer and recent blockhash
  transaction.feePayer = wallet.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  const signature = await wallet.sendTransaction(transaction, connection);

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  }, 'confirmed');

  console.log('[revokeRelayerDelegate] Delegate permission revoked:', signature);

  return signature;
}

