import { parentPort, workerData, isMainThread } from "node:worker_threads";
import { generateDepositProof, generateTransferProof, generateWithdrawProof } from "./index.js";

if (!isMainThread && parentPort) {
  (async () => {
    const { kind, input } = workerData as { kind: "deposit"|"transfer"|"withdraw"; input: any };
    const fn = kind === "deposit" ? generateDepositProof
            : kind === "transfer" ? generateTransferProof
            : generateWithdrawProof;
    const res = await fn(input);
    parentPort!.postMessage(res);
  })().catch(e => parentPort!.postMessage({ error: String(e) }));
}
