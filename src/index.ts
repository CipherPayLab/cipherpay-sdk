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
export { poseidonHash } from "./crypto/poseidon.js";
export { commitmentOf } from "./notes/commitment.js";

// Flow exports
export { deposit } from "./flows/deposit.js";
export type { DepositParams, DepositResult } from "./flows/deposit.js";
