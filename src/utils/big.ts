/** Coerce many input shapes (hex/dec string, number, bigint, BN) → bigint */
export function toBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") {
    const s = v.trim();
    return BigInt(s.startsWith("0x") ? s : BigInt(s));
  }
  if (v && typeof (v as any).toString === "function") return BigInt((v as any).toString());
  throw new TypeError(`toBigInt: unsupported ${typeof v}`);
}

/** 32-byte BE bytes for on-chain packing */
export function beBytes32(x: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = x;
  for (let i = 31; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
}

export function hex0x(u8: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(u8).toString("hex")}`;
}

export function bytes32HexBE(x: bigint): `0x${string}` {
  return hex0x(beBytes32(x));
}
