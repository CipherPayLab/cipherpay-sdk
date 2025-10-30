import { Connection, PublicKey } from "@solana/web3.js";

export type DepositEvent = { commitment: `0x${string}`; index: number; merkleRoot: `0x${string}` };
export type TransferEvent = { newCommitment: `0x${string}`; merkleRoot: `0x${string}` };
export type WithdrawEvent = { nullifier: `0x${string}`; amount: `0x${string}`; merkleRoot: `0x${string}` };

export function subscribeProgramEvents(
  connection: Connection,
  programId: PublicKey,
  on: {
    deposit?: (e: DepositEvent) => void;
    transfer?: (e: TransferEvent) => void;
    withdraw?: (e: WithdrawEvent) => void;
    error?: (e: Error) => void;
  }
) {
  return connection.onLogs(programId, (l) => {
    try {
      for (const m of l.logs ?? []) {
        // Simple JSON-tagged log convention (add in your Anchor events if desired)
        if (m.startsWith("EVENT:")) {
          const payload = JSON.parse(m.slice(6));
          if (payload.kind === "DepositCompleted") on.deposit?.(payload.data);
          if (payload.kind === "TransferCompleted") on.transfer?.(payload.data);
          if (payload.kind === "WithdrawCompleted") on.withdraw?.(payload.data);
        }
      }
    } catch (e: any) {
      on.error?.(e);
    }
  }, "confirmed");
}
