export function u8aFromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Uint8Array.from(clean.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
}
export function hexFromU8a(u8a: Uint8Array): string {
  return "0x" + Array.from(u8a).map(b => b.toString(16).padStart(2, "0")).join("");
}
