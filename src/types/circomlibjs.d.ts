declare module "circomlibjs" {
  export function buildPoseidonOpt(): Promise<any>;
  export function buildPoseidon(): Promise<any>;
  export function buildPoseidonWasm(): Promise<any>;
  export function buildBabyjub(): Promise<any>;
  export function buildEddsa(): Promise<any>;
  export function buildMimc7(): Promise<any>;
  export function buildMimcSponge(): Promise<any>;
  export function buildPedersenHash(): Promise<any>;
}

