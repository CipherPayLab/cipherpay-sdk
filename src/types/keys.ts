import { Field } from "./core.js";

export interface CipherPayKeypair {
  pubKey: Field;
  privKey: Field;
}

export interface ViewKey {
  vk: Field;
}

export interface Identity {
  keypair: CipherPayKeypair;
  viewKey: ViewKey;
  recipientCipherPayPubKey: Field;
}
