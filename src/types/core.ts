export type Field = bigint;

export interface MerklePath {
  root: Field;
  leaf: Field;
  index: number;
  siblings: Field[]; // bottom-up
}

export type Commitment = Field;
export type Nullifier  = Field;

export interface Note {
  amount: bigint;                 // smallest units
  tokenId: Field;                 // field hash of token descriptor
  ownerCipherPayPubKey: Field;    // Poseidon(pubKey, privKey)
  randomness: { r: Field; s?: Field };
  memo?: string | bigint;
}
