let _poseidon: ((xs: bigint[]) => any) | null = null;
let _F: any | null = null;

/**
 * Load circomlibjs poseidon in a way that works for both CJS and ESM builds.
 * Prefer buildPoseidon() when available; otherwise fall back to poseidon export.
 * This matches the relayer's implementation to ensure consistency.
 */
async function loadCircomPoseidon(): Promise<{ poseidon: (xs: bigint[]) => any; F: any }> {
  if (_poseidon && _F) return { poseidon: _poseidon!, F: _F! };

  const mod: any = await import("circomlibjs");

  // Try to find buildPoseidon from any of the usual places
  const buildPoseidon =
    mod.buildPoseidon ||
    mod.buildPoseidonOpt ||
    mod.default?.buildPoseidon ||
    mod.default?.buildPoseidonOpt ||
    mod?.wasm?.buildPoseidon;

  if (typeof buildPoseidon === "function") {
    const p = await buildPoseidon();
    _poseidon = (xs: bigint[]) => p(xs); // p is the poseidon function
    _F = p.F;
  } else {
    // Fall back to direct poseidon export (CJS style)
    const p = mod.poseidon || mod.default?.poseidon;
    if (!p) {
      throw new Error(
        "circomlibjs: neither buildPoseidon() nor poseidon export found. Please ensure circomlibjs is installed correctly."
      );
    }
    _poseidon = (xs: bigint[]) => p(xs);
    _F = p.F;
  }

  if (!_F || typeof _F.toObject !== "function") {
    throw new Error("circomlibjs: Poseidon field 'F' is missing or invalid.");
  }

  return { poseidon: _poseidon!, F: _F! };
}

/**
 * Poseidon hash for authentication (legacy format - Uint8Array to BigInt conversion).
 * This maintains compatibility with existing authentication systems.
 * Use poseidonHashForCircuit() for circuit proofs that need to match the relayer.
 */
export async function poseidonHashForAuth(
  inputs: Array<bigint | number | string>
): Promise<bigint> {
  const { poseidon } = await loadCircomPoseidon();
  
  // Convert inputs to bigint array (same as poseidonHash)
  const arr = inputs.map((v, idx) => {
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(v);

    if (typeof v === "string") {
      if (v.includes(",") && /^\d+(,\d+)+$/.test(v)) {
        const nums = v.split(",").map((x) => parseInt(x.trim(), 10));
        const hex = nums
          .map((b) => {
            if (Number.isNaN(b) || b < 0 || b > 255) {
              throw new Error(
                `Invalid byte in CSV at input[${idx}]: ${b} (${v.slice(
                  0,
                  50
                )}...)`
              );
            }
            return b.toString(16).padStart(2, "0");
          })
          .join("");
        return BigInt("0x" + hex);
      }
      if (v.startsWith("0x") || v.startsWith("0X")) return BigInt(v);
      return BigInt(v);
    }

    if (v && typeof v === "object") {
      const obj = v as any;
      if (obj instanceof Uint8Array || obj instanceof ArrayBuffer) {
        const ua = obj instanceof Uint8Array ? obj : new Uint8Array(obj);
        const hex = Array.from(ua)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        return BigInt("0x" + hex);
      }
    }

    if (Array.isArray(v)) {
      const ua = new Uint8Array(v as number[]);
      const hex = Array.from(ua)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return BigInt("0x" + hex);
    }

    // Handle generic array-like objects (exclude Date via tag)
    if (
      v !== null &&
      typeof v === "object" &&
      typeof (v as any).length === "number" &&
      Object.prototype.toString.call(v) !== "[object Date]"
    ) {
      try {
        const nums: number[] = [];
        const a: any = v;
        for (let i = 0; i < a.length; i++) nums.push(Number(a[i]));
        const hex = nums.map((b) => b.toString(16).padStart(2, "0")).join("");
        return BigInt("0x" + hex);
      } catch {
        /* fall through */
      }
    }

    const s = String(v);
    if (s.includes(",") && /^\d+(,\d+)+$/.test(s)) {
      const nums = s.split(",").map((x) => parseInt(x.trim(), 10));
      const hex = nums.map((b) => b.toString(16).padStart(2, "0")).join("");
      return BigInt("0x" + hex);
    }
    return BigInt(s);
  });

  const poseidonInputs: bigint[] = arr.map((v) =>
    typeof v === "bigint" ? v : BigInt(v as any)
  );

  try {
    const out = poseidon(poseidonInputs);
    
    // Legacy format: Convert Uint8Array to BigInt using bit-shifting (big-endian)
    if (typeof out === "bigint") {
      return out;
    }

    if (
      out instanceof Uint8Array ||
      (Array.isArray(out) && typeof out[0] === "number")
    ) {
      const bytes = out instanceof Uint8Array ? out : Uint8Array.from(out);
      let acc = 0n;
      for (let i = 0; i < bytes.length; i++) {
        acc = (acc << 8n) | BigInt(bytes[i]);
      }
      return acc;
    }

    if (out && typeof out.toString === "function") {
      return BigInt(out.toString());
    }

    return BigInt(out);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[Poseidon Auth] Error calling poseidon:", error);
    throw error;
  }
}

/**
 * Poseidon hash for circuit proofs (uses F.toObject() to match relayer).
 * This ensures circuit proofs match what the relayer expects.
 */
export async function poseidonHash(
  inputs: Array<bigint | number | string>
): Promise<bigint> {
  const { poseidon, F } = await loadCircomPoseidon();

  console.log("[Poseidon] Received inputs count:", inputs.length);
  for (let i = 0; i < inputs.length; i++) {
    const v = inputs[i] as any;
    const type = typeof v;
    console.log(
      `[Poseidon] Input[${i}]: type=${type}, isArray=${Array.isArray(
        v
      )}, sample=${String(v).substring(0, 50)}`
    );
    if (type === "object" && v !== null && !Array.isArray(v)) {
      if (!(v instanceof Uint8Array) && typeof (v as any).length === "number") {
        console.error(`[Poseidon] WARN: Input[${i}] is array-like`, v);
      }
    }
  }

  // Convert inputs to bigint array
  const arr = inputs.map((v, idx) => {
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(v);

    if (typeof v === "string") {
      if (v.includes(",") && /^\d+(,\d+)+$/.test(v)) {
        const nums = v.split(",").map((x) => parseInt(x.trim(), 10));
        const hex = nums
          .map((b) => {
            if (Number.isNaN(b) || b < 0 || b > 255) {
              throw new Error(
                `Invalid byte in CSV at input[${idx}]: ${b} (${v.slice(
                  0,
                  50
                )}...)`
              );
            }
            return b.toString(16).padStart(2, "0");
          })
          .join("");
        return BigInt("0x" + hex);
      }
      if (v.startsWith("0x") || v.startsWith("0X")) return BigInt(v);
      return BigInt(v);
    }

    if (v && typeof v === "object") {
      const obj = v as any;
      if (obj instanceof Uint8Array || obj instanceof ArrayBuffer) {
        const ua = obj instanceof Uint8Array ? obj : new Uint8Array(obj);
        const hex = Array.from(ua)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        return BigInt("0x" + hex);
      }
    }

    if (Array.isArray(v)) {
      const ua = new Uint8Array(v as number[]);
      const hex = Array.from(ua)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return BigInt("0x" + hex);
    }

    // Handle generic array-like objects (exclude Date via tag)
    if (
      v !== null &&
      typeof v === "object" &&
      typeof (v as any).length === "number" &&
      Object.prototype.toString.call(v) !== "[object Date]"
    ) {
      try {
        const nums: number[] = [];
        const a: any = v;
        for (let i = 0; i < a.length; i++) nums.push(Number(a[i]));
        const hex = nums.map((b) => b.toString(16).padStart(2, "0")).join("");
        return BigInt("0x" + hex);
      } catch {
        /* fall through */
      }
    }

    const s = String(v);
    if (s.includes(",") && /^\d+(,\d+)+$/.test(s)) {
      const nums = s.split(",").map((x) => parseInt(x.trim(), 10));
      const hex = nums.map((b) => b.toString(16).padStart(2, "0")).join("");
      return BigInt("0x" + hex);
    }
    return BigInt(s);
  });

  // Ensure BigInt array
  const poseidonInputs: bigint[] = arr.map((v) =>
    typeof v === "bigint" ? v : BigInt(v as any)
  );
  
  console.log(
    "[Poseidon] About to call poseidon with BigInts:",
    poseidonInputs.map((v, i) => ({ i, sample: v.toString().substring(0, 30) }))
  );

  console.log(
    "[Poseidon] Calling circomlibjs poseidon with BigInt array, length:",
    poseidonInputs.length
  );

  try {
    // Call poseidon and convert result using F.toObject() - this matches the relayer's approach
    const out = poseidon(poseidonInputs);
    const result = F.toObject(out) as bigint;
    
    console.log("[Poseidon] poseidon returned:", typeof out, out);
    console.log("[Poseidon] Converted using F.toObject():", result.toString());
    
    return result;
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[Poseidon] Error calling poseidon:", error);
    console.error("[Poseidon] Error type:", typeof error, err?.constructor?.name);
    console.error("[Poseidon] Error message:", err?.message);
    console.error("[Poseidon] Error stack:", err?.stack);
    console.error(
      "[Poseidon] Inputs that caused error:",
      poseidonInputs.map((v, i) => ({
        i,
        type: typeof v,
        isBigInt: typeof v === "bigint",
        value:
          typeof v === "bigint"
            ? v.toString().substring(0, 50)
            : String(v).substring(0, 50),
      }))
    );
    throw error;
  }
}
