import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction, sendAndConfirmTransaction, } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, } from "@solana/spl-token";
import { createIdentity } from "../src/keys/identity.js";
import { tokenIdOf } from "../src/registry/tokenId.js";
import { buildNote } from "../src/notes/note.js";
import { commitmentOf } from "../src/notes/commitment.js";
import { encodeDepositCallData, buildShieldedDepositIx } from "../src/chains/solana/anchor.js";
import { RelayerClient } from "../src/relayer/client.js";
import { TOKENS, Networks } from "../src/index.js";
import { generateDepositProof } from "../src/circuits/deposit/prover.js";
// NEW: send helper + WSOL auto-wrap
import { createKeypairSend } from "../src/chains/solana/tx.js";
import { wrapWSOLIfNeeded } from "../src/chains/solana/token.js";
// ────────────────────────────────────────────────────────────────────────────────
const RPC = process.env.RPC_URL ?? Networks.devnet.solana.rpcUrl;
const RELAYER = process.env.RELAYER_URL ?? Networks.devnet.relayer.baseUrl;
const PROGRAM_ID = new PublicKey(process.env.CIPHERPAY_PROGRAM_ID ?? "11111111111111111111111111111111");
const WSOL_MINT = new PublicKey(TOKENS.WSOL.solana.mint);
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
(async function main() {
    const connection = new Connection(RPC, "confirmed");
    const relayer = new RelayerClient(RELAYER);
    // Node signer + send()
    const user = Keypair.generate();
    const send = createKeypairSend(connection, user);
    console.log("User:", user.publicKey.toBase58());
    await airdropSol(connection, user.publicKey, 2);
    // Ensure WSOL ATA exists (no wrap yet; wrapWSOLIfNeeded will handle top-up)
    const userWsolAta = await ensureAtaIfMissing(connection, user, user.publicKey, WSOL_MINT);
    // Build identity/note
    const identity = await createIdentity();
    const tokenId = await tokenIdOf(TOKENS.WSOL);
    const amountAtoms = 1000000n; // 0.001 SOL
    const note = buildNote({
        amount: amountAtoms,
        tokenId,
        ownerCipherPayPubKey: identity.recipientCipherPayPubKey,
        memo: undefined,
    });
    const commitment = await commitmentOf(note);
    // Merkle snapshot
    const { root: merkleRoot, nextIndex } = await relayer.getRoot();
    // Prover input
    const depositInput = {
        amount: note.amount.toString(),
        tokenId: note.tokenId.toString(),
        ownerCipherPayPubKey: note.ownerCipherPayPubKey.toString(),
        r: note.randomness.r.toString(),
        s: (note.randomness.s ?? 0n).toString(),
        merkleRoot: merkleRoot.toString(),
        leafIndex: String(nextIndex),
        siblings: [],
        depositHash: "0"
    };
    const { proof, publicSignals } = await generateDepositProof(depositInput);
    // AUTO-WRAP WSOL if the user’s WSOL balance is below the needed atoms
    await wrapWSOLIfNeeded(connection, user.publicKey, Number(publicSignals.amount), // lamports needed
    user.publicKey, 
    // adapt our send(tx) helper to the expected signature
    async (tx) => send(tx));
    // Vault ATA (program init_if_needed)
    const [vaultAuthorityPda] = deriveVaultAuthorityPda();
    const vaultWsolAta = getAssociatedTokenAddressSync(WSOL_MINT, vaultAuthorityPda, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    // Encode call data
    const data = encodeDepositCallData({
        proof,
        amount: BigInt(publicSignals.amount),
        depositHash: BigInt(publicSignals.depositHash),
        newCommitment: BigInt(publicSignals.newCommitment),
        ownerCipherPayPubKey: BigInt(publicSignals.ownerCipherPayPubKey),
        merkleRoot: BigInt(publicSignals.merkleRoot),
        nextLeafIndex: Number(publicSignals.nextLeafIndex),
    });
    // Build IX & send
    const ix = buildShieldedDepositIx({
        programId: PROGRAM_ID,
        accounts: {
            payer: user.publicKey,
            user: user.publicKey,
            userTokenAta: userWsolAta,
            vaultAuthorityPda,
            vaultTokenAta: vaultWsolAta,
            mint: WSOL_MINT,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        },
        data,
    });
    const tx = new Transaction().add(ix);
    const sig = await send(tx);
    console.log("Sent shielded_deposit tx:", sig);
    // (Optional interim) relayer.appendCommitment(commitment);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
