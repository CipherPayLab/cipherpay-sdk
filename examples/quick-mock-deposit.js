import { InMemoryRelayer, TOKENS, createIdentity, deposit } from "../src/index.js";
async function main() {
    const relayer = new InMemoryRelayer(20);
    const id = await createIdentity();
    const result = await deposit({
        identity: id,
        token: TOKENS.WSOL,
        amount: { uiAmount: 0.01, atoms: 10000000n },
        chainContext: {}, // skip chain calls for now
        relayer
    });
    // Append commitment to relayer to simulate canonical tree update (until you hook on-chain)
    const appended = await relayer.appendCommitment(result.commitment);
    console.log("Mock append:", appended);
    const path = await relayer.getProofByIndex(appended.index);
    console.log("Merkle path:", path);
}
main().catch(console.error);
