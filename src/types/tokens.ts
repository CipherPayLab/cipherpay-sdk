export type Chain = "solana" | "evm";

export interface TokenDescriptor {
  chain: Chain;
  symbol: string;
  decimals: number;
  solana?: { mint: string };
  evm?: { address: string; chainId: number };
}

export interface Amount {
  uiAmount: number;
  atoms: bigint;
}
