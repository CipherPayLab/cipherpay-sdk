// Main SDK export for browser usage
import { CipherPaySDK as SDK } from "./sdk.js";

// For browser IIFE bundle, make the SDK the default export
export default SDK;

// Named exports for module usage
export { CipherPaySDK } from "./sdk.js";
export type { SDKConfig } from "./sdk.js";

// Utility exports for server usage
export { TOKENS } from "./config/assets.js";
export { bigintifySignals } from "./utils/zk.js";
export { poseidonHash, poseidonHashForAuth } from "./crypto/poseidon.js";
export { commitmentOf } from "./notes/commitment.js";

// Note encryption exports
// Note: The new secure approach uses Curve25519 public keys directly from DB
// No derivation functions are needed - the public key is used directly for encryption

// Identity exports
export { createIdentity, deriveRecipientCipherPayPubKey } from "./keys/identity.js";
export type { CipherPayKeypair, ViewKey, Identity } from "./types/keys.js";

// Flow exports
export { deposit } from "./flows/deposit.js";
export type { DepositParams, DepositResult } from "./flows/deposit.js";
export { transfer } from "./flows/transfer.js";
export type { TransferParams, TransferResult } from "./flows/transfer.js";

// Solana delegate approval (one-time setup for deposits)
export { approveRelayerDelegate, revokeRelayerDelegate } from "./chains/solana/delegate.js";
export type { ApproveRelayerDelegateParams, ApproveRelayerDelegateResult } from "./chains/solana/delegate.js";
