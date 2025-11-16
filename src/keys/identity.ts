import { Identity, CipherPayKeypair } from "../types/keys.js";
import { poseidon2, randomField } from "../utils/crypto.js";

function generateKeypair(): CipherPayKeypair {
  // Generate distinct random field elements for public and private keys
  // Note: For enhanced security, consider using curve-based key derivation in the future
  const privKey = randomField();
  const pubKey = randomField(); // Generate separate random public key
  return { privKey, pubKey };
}

export async function deriveRecipientCipherPayPubKey(kp: CipherPayKeypair): Promise<bigint> {
  return await poseidon2([kp.pubKey, kp.privKey]);
}

export async function createIdentity(): Promise<Identity> {
  const keypair = generateKeypair();
  const viewKey = { vk: await poseidon2([keypair.privKey, 1n]) };
  return {
    keypair,
    viewKey,
    recipientCipherPayPubKey: await deriveRecipientCipherPayPubKey(keypair)
  };
}
