/**
 * Note Encryption Key Derivation
 * 
 * These functions derive Curve25519 encryption keypairs for E2EE (End-to-End Encryption) of notes.
 * 
 * IMPORTANT CLARIFICATION:
 * - note_enc_pub_key is a Curve25519 public key (base64 encoded), stored in the database
 * - It is derived from the wallet signature seed during authentication
 * - The seed (wallet signature) is NEVER stored - only the derived Curve25519 public key is stored
 * 
 * Security Model:
 * - During authentication: User signs message → derives Curve25519 keypair from signature seed
 *   → saves Curve25519 public key (base64) to DB as note_enc_pub_key
 * - Sender: Gets recipient's note_enc_pub_key (Curve25519 public key) from DB → uses directly for encryption
 * - Recipient: Derives Curve25519 keypair from wallet signature seed when needed → uses secret key for decryption
 * - Both use the same wallet signature seed, ensuring they get the same Curve25519 keypair
 * 
 * This ensures only the recipient can decrypt (they have the secret key from the derived keypair),
 * even if someone has access to the database (they only have the public key).
 */

import * as nacl from "tweetnacl";

/**
 * Convert BigInt to Uint8Array (little-endian, fixed 32 bytes)
 */
function bigIntToBytes32(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let remaining = value;
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(remaining & 0xffn);
    remaining = remaining >> 8n;
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 string (browser-safe)
 */
function u8ToB64(u8: Uint8Array): string {
  // Detect Node.js environment
  const isNode =
    typeof process !== "undefined" &&
    !!(process as any).versions &&
    !!(process as any).versions.node;

  if (isNode) {
    // True Node.js path
    return Buffer.from(u8).toString("base64");
  }
  // Browser-safe path using btoa
  let s = "";
  for (let i = 0; i < u8.length; i++) {
    s += String.fromCharCode(u8[i]);
  }
  return btoa(s);
}


