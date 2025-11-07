import { Identity, CipherPayKeypair } from "../types/keys.js";
import { poseidon2, randomField } from "../utils/crypto.js";

function generateKeypair(): CipherPayKeypair {
  // TODO: swap to curve-based keygen if needed; use field-only for now
  const privKey = randomField();
  const pubKey = privKey; // placeholder; replace with curve * G or hash mapping
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
