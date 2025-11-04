let _poseidon: any | undefined;

async function getPoseidon() {
  if (_poseidon) return _poseidon;
  const lib = await import("circomlibjs");

  // Prefer builder APIs so we can expose the field `F` alongside the function.
  if ((lib as any).buildPoseidon || (lib as any).buildPoseidonOpt) {
    const buildFn = (lib as any).buildPoseidon || (lib as any).buildPoseidonOpt;
    const inst = await buildFn();
    const fn = (inst as any).poseidon ? (inst as any).poseidon : inst;
    if ((inst as any).F && typeof fn === "function") {
      (fn as any).F = (inst as any).F; // expose field as poseidon.F
    }
    _poseidon = fn;
  } else {
    const direct = (lib as any).poseidon ?? (lib as any).default?.poseidon;
    if (!direct) throw new Error("Failed to load circomlibjs poseidon function");
    const maybeF =
      (lib as any).F ||
      (lib as any).poseidon?.F ||
      (lib as any).default?.poseidon?.F;
    if (maybeF && typeof direct === "function") {
      (direct as any).F = maybeF;
    }
    _poseidon = direct;
  }

  if (!_poseidon || typeof _poseidon !== "function") {
    throw new Error("Failed to load circomlibjs poseidon function");
  }
  return _poseidon;
}

export async function poseidonHash(
  inputs: Array<bigint | number | string>
): Promise<bigint> {
  const p = await getPoseidon();

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

  // Ensure BigInt array & log (after declaration)
  const poseidonInputs: bigint[] = arr.map((v) =>
    typeof v === "bigint" ? v : BigInt(v as any)
  );
  console.log(
    "[Poseidon] About to call poseidon with BigInts:",
    poseidonInputs.map((v, i) => ({ i, sample: v.toString().substring(0, 30) }))
  );

  console.log(
    "[Poseidon] Calling poseidon with:",
    poseidonInputs.map((v, i) => ({
      i,
      type: typeof v,
      sample: String(v).substring(0, 30),
    }))
  );

  console.log(
    "[Poseidon] Calling circomlibjs poseidon with BigInt array, length:",
    poseidonInputs.length
  );

  try {
    const out = p(poseidonInputs);
    console.log("[Poseidon] poseidon returned:", typeof out, out);
    console.log("[Poseidon] poseidon return details:", {
      type: typeof out,
      isObject: typeof out === "object",
      hasToString: out && typeof out.toString === "function",
      toStringSample:
        out && typeof out.toString === "function"
          ? out.toString().substring(0, 30)
          : "N/A",
    });

    if (typeof out === "bigint") {
      console.log("[Poseidon] Result is already BigInt");
      return out;
    }

    // Handle byte-array return (Uint8Array -> BigInt, BE)
    if (
      out instanceof Uint8Array ||
      (Array.isArray(out) && typeof out[0] === "number")
    ) {
      const bytes = out instanceof Uint8Array ? out : Uint8Array.from(out);
      let acc = 0n;
      for (let i = 0; i < bytes.length; i++) {
        acc = (acc << 8n) | BigInt(bytes[i]);
      }
      console.log(
        "[Poseidon] Converted result from Uint8Array to BigInt:",
        acc.toString()
      );
      return acc;
    }

    if (out && typeof out.toString === "function") {
      const result = BigInt(out.toString());
      console.log(
        "[Poseidon] Converted result from BN-like to BigInt:",
        result
      );
      return result;
    }

    const finalResult = BigInt(out);
    console.log("[Poseidon] Converted result directly to BigInt:", finalResult);
    return finalResult;
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
