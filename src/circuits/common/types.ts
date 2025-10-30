export interface CircuitArtifacts {
  /** Absolute or relative (to this artifacts.json) path to wasm and zkey */
  wasm: string;
  zkey: string;
  /** Optional: verification key JSON (snarkjs export) */
  vkey?: string;
}

export interface ProveResult<TPublicSignals = unknown> {
  proof: unknown;            // snarkjs Groth16 proof object
  publicSignals: TPublicSignals;
}
