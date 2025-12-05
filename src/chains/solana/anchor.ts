import { PublicKey, TransactionInstruction, AccountMeta } from "@solana/web3.js";
import { serialize, Schema } from "borsh";

// ---------- Discriminator ----------
/** Anchor discriminator = first 8 bytes of sha256("global:<methodName>") */
export function methodDiscriminator(name: string): Uint8Array {
  const data = new TextEncoder().encode(`global:${name}`);
  
  // Use Web Crypto API in browser, Node.js crypto in Node
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    // Browser: use Web Crypto API (async)
    // For sync version, we'll use a polyfill or fallback
    throw new Error('methodDiscriminator requires async crypto in browser. Use async version instead.');
  }
  
  // Node.js: use crypto module
  try {
    // @ts-ignore
    const { createHash } = require("node:crypto") as typeof import("node:crypto");
    const sha = createHash("sha256").update(data).digest();
    return sha.subarray(0, 8);
  } catch (e) {
    // Fallback: use Web Crypto API (if available, but it's async)
    throw new Error('methodDiscriminator requires Node.js crypto or async Web Crypto API');
  }
}

// ---------- Encoding helpers ----------
function beBytes32(x: bigint): Uint8Array {
  // Anchor/solana BN usually treated as big-endian 32 bytes (match your on-chain type).
  const out = new Uint8Array(32);
  let v = x;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function leBytes32(x: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = x;
  for (let i = 0; i < 32; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/** Flatten a snarkjs Groth16 proof into bytes. Adjust to your program's expected order. */
export function encodeGroth16Proof(proof: any): Uint8Array {
  // snarkjs proof layout:
  // proof.pi_a = [Ax, Ay]
  // proof.pi_b = [[Bx1, Bx2], [By1, By2]]  (G2)
  // proof.pi_c = [Cx, Cy]
  // All values are decimal strings. Convert to 32-byte BE each.
  const parts: bigint[] = [];
  const toBI = (v: any) => BigInt(v.toString());

  parts.push(toBI(proof.pi_a[0]), toBI(proof.pi_a[1]));
  parts.push(toBI(proof.pi_b[0][0]), toBI(proof.pi_b[0][1]));
  parts.push(toBI(proof.pi_b[1][0]), toBI(proof.pi_b[1][1]));
  parts.push(toBI(proof.pi_c[0]), toBI(proof.pi_c[1]));

  const bytes = parts.map(beBytes32);
  const total = new Uint8Array(bytes.length * 32);
  bytes.forEach((b, i) => total.set(b, i * 32));
  return total;
}

// ---------- BORSH args (adjust to match your Rust struct) ----------
// Rust (suggested):
// #[derive(AnchorSerialize, AnchorDeserialize)]
// pub struct ShieldedDepositArgs {
//   pub proof: Vec<u8>,                   // flattened Groth16
//   pub amount: [u8; 32],
//   pub deposit_hash: [u8; 32],
//   pub new_commitment: [u8; 32],
//   pub owner_cipherpay_pubkey: [u8; 32],
//   pub merkle_root: [u8; 32],
//   pub next_leaf_index: u32,
// }
class ShieldedDepositArgs {
  proof!: Uint8Array;
  amount!: Uint8Array;
  deposit_hash!: Uint8Array;
  new_commitment!: Uint8Array;
  owner_cipherpay_pubkey!: Uint8Array;
  merkle_root!: Uint8Array;
  next_leaf_index!: number;

  constructor(fields: {
    proof: Uint8Array;
    amount: Uint8Array;
    deposit_hash: Uint8Array;
    new_commitment: Uint8Array;
    owner_cipherpay_pubkey: Uint8Array;
    merkle_root: Uint8Array;
    next_leaf_index: number;
  }) {
    Object.assign(this, fields);
  }
}

const ShieldedDepositSchema: Schema = new Map([
  [ShieldedDepositArgs, {
    kind: "struct",
    fields: [
      ["proof", ["u8"]],
      ["amount", [32]],
      ["deposit_hash", [32]],
      ["new_commitment", [32]],
      ["owner_cipherpay_pubkey", [32]],
      ["merkle_root", [32]],
      ["next_leaf_index", "u32"],
    ],
  }],
]);

export function encodeDepositCallData(args: {
  proof: any;
  amount: bigint;
  depositHash: bigint;
  newCommitment: bigint;
  ownerCipherPayPubKey: bigint;
  merkleRoot: bigint;
  nextLeafIndex: number;
  method?: string; // default "shielded_deposit"
}): Buffer {
  const method = args.method ?? "shielded_deposit";
  const disc = methodDiscriminator(method);

  const payload = new ShieldedDepositArgs({
    proof: encodeGroth16Proof(args.proof),
    amount: beBytes32(args.amount),
    deposit_hash: beBytes32(args.depositHash),
    new_commitment: beBytes32(args.newCommitment),
    owner_cipherpay_pubkey: beBytes32(args.ownerCipherPayPubKey),
    merkle_root: beBytes32(args.merkleRoot),
    next_leaf_index: args.nextLeafIndex >>> 0,
  });

  const body = serialize(ShieldedDepositSchema, payload);
  return Buffer.concat([Buffer.from(disc), Buffer.from(body)]);
}

// ---------- IX builder ----------
export function buildShieldedDepositIx(params: {
  programId: PublicKey;
  accounts: {
    payer: PublicKey;
    user: PublicKey;              // owner wallet
    userTokenAta: PublicKey;
    vaultAuthorityPda: PublicKey;
    vaultTokenAta: PublicKey;
    mint: PublicKey;

    systemProgram: PublicKey;
    tokenProgram: PublicKey;
    associatedTokenProgram: PublicKey;
    rent?: PublicKey;
  };
  data: Buffer;
}): TransactionInstruction {
  const {
    payer, user, userTokenAta, vaultAuthorityPda, vaultTokenAta, mint,
    systemProgram, tokenProgram, associatedTokenProgram, rent
  } = params.accounts;

  const metas: AccountMeta[] = [
    { pubkey: payer, isSigner: true,  isWritable: true },
    { pubkey: user,  isSigner: false, isWritable: false },
    { pubkey: userTokenAta, isSigner: false, isWritable: true },
    { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
    { pubkey: vaultTokenAta, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },

    { pubkey: systemProgram, isSigner: false, isWritable: false },
    { pubkey: tokenProgram, isSigner: false, isWritable: false },
    { pubkey: associatedTokenProgram, isSigner: false, isWritable: false },
  ];
  if (rent) metas.push({ pubkey: rent, isSigner: false, isWritable: false });

  return new TransactionInstruction({
    programId: params.programId,
    keys: metas,
    data: params.data,
  });
}

class ShieldedWithdrawArgs {
  proof!: Uint8Array;
  nullifier!: Uint8Array;
  merkle_root!: Uint8Array;
  recipient_owner_lo!: Uint8Array;
  recipient_owner_hi!: Uint8Array;
  recipient_wallet_pubkey!: Uint8Array;
  amount!: Uint8Array;
  token_id!: Uint8Array;

  constructor(fields: {
    proof: Uint8Array;
    nullifier: Uint8Array;
    merkle_root: Uint8Array;
    recipient_owner_lo: Uint8Array;
    recipient_owner_hi: Uint8Array;
    recipient_wallet_pubkey: Uint8Array;
    amount: Uint8Array;
    token_id: Uint8Array;
  }) {
    Object.assign(this, fields);
  }
}

const ShieldedWithdrawSchema: Schema = new Map([
  [ShieldedWithdrawArgs, {
    kind: "struct",
    fields: [
      ["proof", ["u8"]],
      ["nullifier", [32]],
      ["merkle_root", [32]],
      ["recipient_owner_lo", [32]],
      ["recipient_owner_hi", [32]],
      ["recipient_wallet_pubkey", [32]],
      ["amount", [32]],
      ["token_id", [32]],
    ],
  }],
]);

export function encodeWithdrawCallData(args: {
  proof: any;
  nullifier: bigint;
  merkleRoot: bigint;
  recipientOwnerLo: bigint;
  recipientOwnerHi: bigint;
  recipientWalletPublicKey: PublicKey;
  amount: bigint;
  tokenId: bigint;
  method?: string;
}): Buffer {
  const method = args.method ?? "shielded_withdraw";
  const disc = methodDiscriminator(method);

  const payload = new ShieldedWithdrawArgs({
    proof: encodeGroth16Proof(args.proof),
    nullifier: beBytes32(args.nullifier),
    merkle_root: beBytes32(args.merkleRoot),
    recipient_owner_lo: leBytes32(args.recipientOwnerLo),
    recipient_owner_hi: leBytes32(args.recipientOwnerHi),
    recipient_wallet_pubkey: args.recipientWalletPublicKey.toBytes(),
    amount: beBytes32(args.amount),
    token_id: beBytes32(args.tokenId),
  });

  const body = serialize(ShieldedWithdrawSchema, payload);
  return Buffer.concat([Buffer.from(disc), Buffer.from(body)]);
}

export function buildShieldedWithdrawIx(params: {
  programId: PublicKey;
  accounts: {
    payer: PublicKey;
    user: PublicKey;
    userTokenAta: PublicKey;
    vaultAuthorityPda: PublicKey;
    vaultTokenAta: PublicKey;
    mint: PublicKey;

    systemProgram: PublicKey;
    tokenProgram: PublicKey;
    associatedTokenProgram: PublicKey;
    rent?: PublicKey;
  };
  data: Buffer;
}): TransactionInstruction {
  const {
    payer, user, userTokenAta, vaultAuthorityPda, vaultTokenAta, mint,
    systemProgram, tokenProgram, associatedTokenProgram, rent
  } = params.accounts;

  const metas: AccountMeta[] = [
    { pubkey: payer, isSigner: true,  isWritable: true },
    { pubkey: user,  isSigner: false, isWritable: false },
    { pubkey: userTokenAta, isSigner: false, isWritable: true },
    { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
    { pubkey: vaultTokenAta, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },

    { pubkey: systemProgram, isSigner: false, isWritable: false },
    { pubkey: tokenProgram, isSigner: false, isWritable: false },
    { pubkey: associatedTokenProgram, isSigner: false, isWritable: false },
  ];
  if (rent) metas.push({ pubkey: rent, isSigner: false, isWritable: false });

  return new TransactionInstruction({
    programId: params.programId,
    keys: metas,
    data: params.data,
  });
}
