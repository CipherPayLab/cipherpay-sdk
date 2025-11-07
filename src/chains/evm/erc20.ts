import { Contract, JsonRpcProvider, Wallet } from "ethers";

export async function ensureAllowance(
  provider: JsonRpcProvider,
  owner: Wallet,
  token: string,
  spender: string,
  amount: bigint
) {
  const abi = ["function allowance(address,address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
  const erc20 = new Contract(token, abi, owner.connect(provider));
  const from = await owner.getAddress();
  const current: bigint = await erc20.allowance(from, spender);
  if (current < amount) {
    const tx = await erc20.approve(spender, amount);
    await tx.wait();
  }
}
