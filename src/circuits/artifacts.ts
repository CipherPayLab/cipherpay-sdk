import { createHash } from "node:crypto";
import fs from "node:fs/promises";
type Artifacts = { wasm: string; zkey: string; vkey: string; sha256?: { wasm?: string; zkey?: string; vkey?: string } };

const cache = new Map<string, Artifacts>();

export async function loadArtifacts(kind: "deposit"|"transfer"|"withdraw", base = `./src/circuits/${kind}/artifacts.json`): Promise<Artifacts> {
  if (cache.has(base)) return cache.get(base)!;
  const raw = JSON.parse(await fs.readFile(base, "utf8")) as Artifacts;
  if (raw.sha256) {
    for (const k of ["wasm","zkey","vkey"] as const) {
      if (!raw.sha256[k]) continue;
      const buf = await fs.readFile(resolveRel(base, raw[k]));
      const sum = sha256(buf);
      if (sum !== raw.sha256[k]) throw new Error(`${kind} ${k} integrity mismatch`);
    }
  }
  cache.set(base, raw);
  return raw;
}
function resolveRel(base: string, p: string) { return new URL(p, new URL(base, "file://")).pathname; }
function sha256(b: Buffer) { return createHash("sha256").update(b).digest("hex"); }
