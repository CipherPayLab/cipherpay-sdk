import { Note } from "../types/core.js";
import { ViewKey } from "../types/keys.js";

export function encryptNote(_note: Note, _recipientCipherPayPubKey: bigint): Uint8Array {
  // TODO: real ECIES-like scheme (for now return placeholder)
  return new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
}

export function decrypt_note(_ciphertext: Uint8Array, _vk: ViewKey): Note {
  // TODO: real decryption; placeholder to unblock flows
  throw new Error("decrypt_note() not implemented");
}
