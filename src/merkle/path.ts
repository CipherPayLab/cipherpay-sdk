import { MerklePath } from "../types/core.js";
import { poseidon2 } from "../utils/crypto.js";

export async function verifyPath(path: MerklePath): Promise<boolean> {
  let h = path.leaf;
  const bits = path.index.toString(2).split("").reverse();
  for (let i = 0; i < path.siblings.length; i++) {
    const sib = path.siblings[i];
    const isRight = bits[i] === "1";
    h = isRight ? await poseidon2([sib, h]) : await poseidon2([h, sib]);
  }
  return h === path.root;
}
