import { createIdentity, tokenIdOf, TOKENS } from "../src/index.js";
import { generateDepositProof } from "../src/circuits/deposit/prover.js";

async function main() {
  const id = await createIdentity();
  const tokenId = await tokenIdOf(TOKENS.WSOL);

  // Minimal fake input matching your deposit circuit
  const input = {
    amount: "10000000", // 0.01 in atoms (string)
    tokenId: tokenId.toString(),
    ownerCipherPayPubKey: id.recipientCipherPayPubKey.toString(),
    r: "123456789",     // replace with random field as string
    s: "0",
    merkleRoot: "0",
    leafIndex: "0",
    siblings: [],
    depositHash: "0"
  };

  const { proof, publicSignals } = await generateDepositProof(input);
  console.log("Proof:", !!proof, "Signals:", publicSignals);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
