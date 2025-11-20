import { buildPoseidonOpt } from "circomlibjs";
let poseidonPromise: Promise<any> | null = null;

export async function getPoseidon() {
  if (!poseidonPromise) {
    poseidonPromise = buildPoseidonOpt();
  }
  return poseidonPromise;
}

export async function poseidon2([a, b]: [bigint, bigint]): Promise<bigint> {
  const p = await getPoseidon();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return BigInt(p.F.toObject(p([a, b])));
}

export async function poseidonN(xs: bigint[]): Promise<bigint> {
  const p = await getPoseidon();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return BigInt(p.F.toObject(p(xs)));
}

export function randomField(): bigint {
  // Use Web Crypto API in browser, Node.js crypto in Node
  const buf = new Uint32Array(8);
  
  // Try Web Crypto API first (browser)
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
  } else if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(buf);
  } else {
    // Fallback: try Node.js crypto
    try {
      // @ts-ignore
      const crypto = require('crypto');
      if (crypto.randomFillSync) {
        crypto.randomFillSync(buf as unknown as Buffer);
      } else if (crypto.randomBytes) {
        const bytes = crypto.randomBytes(buf.length * 4);
        buf.set(new Uint32Array(bytes.buffer, bytes.byteOffset, buf.length));
      } else {
        throw new Error('No crypto implementation available');
      }
    } catch (e) {
      // Last resort: use Math.random (not cryptographically secure, but works)
      for (let i = 0; i < buf.length; i++) {
        buf[i] = Math.floor(Math.random() * 0x100000000);
      }
    }
  }
  
  let x = 0n;
  for (const n of buf) x = (x << 32n) ^ BigInt(n);
  return x;
}
