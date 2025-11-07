import { TokenDescriptor } from "../types/tokens.js";

export const TOKENS: Record<string, TokenDescriptor> = {
  WSOL: {
    chain: "solana",
    symbol: "wSOL",
    decimals: 9,
    solana: { mint: "So11111111111111111111111111111111111111112" }
  },
  // Fill with your wrapped assets + USDC etc.
};
