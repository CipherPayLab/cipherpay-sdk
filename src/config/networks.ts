export interface NetworkConfig {
  name: "devnet" | "testnet" | "mainnet";
  solana?: { rpcUrl: string; programId: string };
  evm?: { rpcUrl: string; chainId: number; vaultAddress: string };
  relayer: { baseUrl: string };
}

export const Networks: Record<string, NetworkConfig> = {
  devnet: {
    name: "devnet",
    solana: {
      rpcUrl: "https://api.devnet.solana.com",
      programId: "11111111111111111111111111111111" // TODO: replace
    },
    evm: {
      rpcUrl: "http://127.0.0.1:8545",
      chainId: 31337,
      vaultAddress: "0x0000000000000000000000000000000000000000"
    },
    relayer: { baseUrl: "http://127.0.0.1:8787" }
  }
};
