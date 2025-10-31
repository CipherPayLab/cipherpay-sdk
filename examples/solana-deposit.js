import { Networks, TOKENS, createIdentity, deposit } from "../src/index.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
async function main() {
    const net = Networks.devnet;
    const id = await createIdentity();
    const connection = new Connection(net.solana.rpcUrl, "confirmed");
    // For demo only — replace with wallet adapter send
    const owner = Keypair.generate();
    const payer = owner;
    const mint = new PublicKey(TOKENS.WSOL.solana.mint);
    const result = await deposit({
        identity: id,
        token: TOKENS.WSOL,
        amount: { uiAmount: 0.01, atoms: 10000000n },
        tokenId: 1n, // TODO: replace with Poseidon hash of token descriptor
        chainContext: {
            solana: {
                connection,
                owner: owner.publicKey,
                payer: owner.publicKey,
                mint,
                programId: new PublicKey(net.solana.programId),
                vaultAuthorityPda: new PublicKey("11111111111111111111111111111111"),
                send: async (tx) => {
                    tx.feePayer = owner.publicKey;
                    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                    tx.partialSign(owner);
                    const raw = tx.serialize();
                    return await connection.sendRawTransaction(raw, { skipPreflight: true });
                }
            }
        },
        relayer: new (class DummyRelayer {
            async appendCommitment() { return { commitment: 0n, index: 0, merkleRoot: 0n }; }
            async getProof() { return { exists: false, path: { root: 0n, leaf: 0n, index: 0, siblings: [] } }; }
        })()
    });
    console.log("Deposit result:", result);
}
main().catch(console.error);
