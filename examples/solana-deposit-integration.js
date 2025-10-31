/**
 * Usage -
# in the repo root
npm i
export CIPHERPAY_PROGRAM_ID=<YOUR_PROGRAM_ID>   # optional; otherwise uses 111... placeholder
npm ts-node examples/solana-deposit-integration.ts
# or:
npx ts-node examples/solana-deposit-integration.ts
 */
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction, sendAndConfirmTransaction, } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createSyncNativeInstruction, } from "@solana/spl-token";
import { encodeDepositCallData, buildShieldedDepositIx } from "../src/chains/solana/anchor.js";
import { InMemoryRelayer } from "../src/relayer/mock.js"; // only used here to fake a root/index
import { createIdentity } from "../src/keys/identity.js";
// ────────────────────────────────────────────────────────────────────────────────
// CONFIG – replace PROGRAM_ID and (optionally) WSOL mint if using a fork
// ────────────────────────────────────────────────────────────────────────────────
const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(process.env.CIPHERPAY_PROGRAM_ID ?? "11111111111111111111111111111111");
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
// PDA must match your Anchor seeds in deposit.rs: #[account(seeds = [b"vault-authority"], bump)]
function deriveVaultAuthorityPda() {
    return PublicKey.findProgramAddressSync([Buffer.from("vault-authority")], PROGRAM_ID);
}
async function airdropSol(connection, pubkey, sol = 2) {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
}
async function ensureAtaIfMissing(connection, payer, owner, mint) {
    const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const info = await connection.getAccountInfo(ata);
    if (!info) {
        const ix = createAssociatedTokenAccountInstruction(payer.publicKey, ata, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
        const tx = new Transaction().add(ix);
        await sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });
    }
    return ata;
}
async function wrapSolToWsol(connection, owner, wsolAta, lamports) {
    const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: wsolAta, lamports }), createSyncNativeInstruction(wsolAta));
    await sendAndConfirmTransaction(connection, tx, [owner], { commitment: "confirmed" });
}
function makeDummyGroth16Proof() {
    // Shape compatible with snarkjs: all limbs as decimal-like strings work fine for our encoder.
    return {
        pi_a: ["1", "2"],
        pi_b: [["3", "4"], ["5", "6"]],
        pi_c: ["7", "8"],
    };
}
(async function main() {
    const connection = new Connection(RPC, "confirmed");
    const user = Keypair.generate();
    const payer = user; // same signer for simplicity
    const [vaultAuthorityPda] = deriveVaultAuthorityPda();
    console.log("User:", user.publicKey.toBase58());
    await airdropSol(connection, user.publicKey, 2);
    console.log("Airdropped 2 SOL");
    // 1) Ensure WSOL ATA and wrap 0.02 SOL to WSOL
    const userWsolAta = await ensureAtaIfMissing(connection, payer, user.publicKey, WSOL_MINT);
    await wrapSolToWsol(connection, user, userWsolAta, 0.02 * LAMPORTS_PER_SOL);
    console.log("Wrapped 0.02 SOL → WSOL");
    // 2) Derive vault ATA (program will init_if_needed via CPI in our Anchor code)
    const vaultWsolAta = getAssociatedTokenAddressSync(WSOL_MINT, vaultAuthorityPda, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    // 3) Fake relayer root/index (until your on-chain event listener is wired)
    const relayer = new InMemoryRelayer(20);
    const { root: merkleRoot, nextIndex } = await relayer.getRoot();
    // 4) Build dummy public signals consistent with on-chain format:
    //    - all 32-byte BE words; we pass as bigint here and encoder will pack.
    const id = await createIdentity();
    const amountAtoms = BigInt(1_000_000); // 0.001 SOL worth of WSOL (adjust as you like)
    const publicSignals = {
        amount: amountAtoms,
        depositHash: 0n, // you will compute this in the real circuit
        newCommitment: 123456789n, // placeholder commitment
        ownerCipherPayPubKey: id.recipientCipherPayPubKey,
        merkleRoot: merkleRoot,
        nextLeafIndex: nextIndex, // circuit output in v3 design
    };
    const proof = makeDummyGroth16Proof();
    const data = encodeDepositCallData({
        proof,
        amount: publicSignals.amount,
        depositHash: publicSignals.depositHash,
        newCommitment: publicSignals.newCommitment,
        ownerCipherPayPubKey: publicSignals.ownerCipherPayPubKey,
        merkleRoot: publicSignals.merkleRoot,
        nextLeafIndex: publicSignals.nextLeafIndex,
    });
    // 5) Build the instruction
    const ix = buildShieldedDepositIx({
        programId: PROGRAM_ID,
        accounts: {
            payer: payer.publicKey,
            user: user.publicKey,
            userTokenAta: userWsolAta,
            vaultAuthorityPda,
            vaultTokenAta: vaultWsolAta,
            mint: WSOL_MINT,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            // rent omitted; add if your program requires it
        },
        data,
    });
    // 6) Send the transaction
    const tx = new Transaction().add(ix);
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const sig = await sendAndConfirmTransaction(connection, tx, [payer, user], { commitment: "confirmed" });
    console.log("Sent shielded_deposit tx:", sig);
    // 7) (Temporary) append to mock relayer so you can fetch a path and test verify flow
    const appended = await relayer.appendCommitment(publicSignals.newCommitment);
    console.log("Mock relayer appended:", appended);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
