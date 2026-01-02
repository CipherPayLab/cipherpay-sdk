// Export all proof generation functions
export { generateDepositProof } from "./deposit/prover.js";
export type { DepositInput, DepositPublicSignals } from "./deposit/prover.js";

export { generateTransferProof } from "./transfer/prover.js";
export type { TransferInput, TransferPublicSignals } from "./transfer/prover.js";

export { generateWithdrawProof } from "./withdraw/prover.js";
export type { WithdrawInput, WithdrawPublicSignals } from "./withdraw/prover.js";


export { generateAuditPaymentProof } from "./audit_payment/prover.js";
export type { AuditPaymentInput, AuditPaymentPublicSignals } from "./audit_payment/prover.js";
