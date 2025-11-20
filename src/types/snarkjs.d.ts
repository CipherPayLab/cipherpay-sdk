declare module "snarkjs" {
  export namespace groth16 {
    function prove(
      wasmFile: string,
      zkeyFile: string,
      input: Record<string, unknown>
    ): Promise<{ proof: any; publicSignals: any }>;
    
    function verify(
      vkey: unknown,
      publicSignals: unknown,
      proof: unknown
    ): Promise<boolean>;
  }
}

