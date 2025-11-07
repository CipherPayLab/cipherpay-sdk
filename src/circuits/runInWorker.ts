import { isMainThread, Worker } from "node:worker_threads";
import path from "node:path";

export async function runProofInWorker(kind: "deposit"|"transfer"|"withdraw", input: any) {
  if (isMainThread && typeof Worker !== "undefined") {
    const worker = new Worker(path.resolve(new URL(".", import.meta.url).pathname, "./worker.js"), {
      workerData: { kind, input }
    });
    return new Promise((resolve, reject) => {
      worker.on("message", (m) => m?.error ? reject(new Error(m.error)) : resolve(m));
      worker.on("error", reject);
    });
  }
  // fallback same thread
  const { generateDepositProof, generateTransferProof, generateWithdrawProof } = await import("./index.js");
  const fn = kind === "deposit" ? generateDepositProof : kind === "transfer" ? generateTransferProof : generateWithdrawProof;
  return fn(input);
}
