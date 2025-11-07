import { TokenDescriptor } from "../types/tokens.js";
import { poseidonN } from "../utils/crypto.js";

/**
 * Canonicalize a TokenDescriptor into field inputs, then Poseidon-hash → tokenId (Field).
 * Layout (as bigints):
 * [ chainTag, decimals, hash(symbol), hash(optional address/mint), chainIdOrZero ]
 *
 * chainTag: 1 = Solana, 2 = EVM
 */
export async function tokenIdOf(desc: TokenDescriptor): Promise<bigint> {
  const chainTag = desc.chain === "solana" ? 1n : 2n;
  const decimals = BigInt(desc.decimals);
  const symHash = stringHash(desc.symbol);
  const addrOrMint = desc.chain === "solana"
    ? stringHash((desc.solana?.mint ?? "").toLowerCase())
    : stringHash((desc.evm?.address ?? "").toLowerCase());
  const chainId = desc.chain === "evm" ? BigInt(desc.evm!.chainId) : 0n;

  return await poseidonN([chainTag, decimals, symHash, addrOrMint, chainId]);
}

/** Very simple bigint string hasher (NOT cryptographic). Used only as a preimage compressor for Poseidon input. */
function stringHash(s: string): bigint {
  let h = 1469598103934665603n;           // FNV-ish seed
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i) & 0xff);
    h *= 1099511628211n;
  }
  return h & ((1n << 251n) - 1n);         // trim to ~251 bits (safe for BN254 field input preprocessing)
}
