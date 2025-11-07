const ENABLED = (process.env.CIPHERPAY_DEBUG ?? "").split(",").map(s=>s.trim());
export function debug(ns: string, ...args: any[]) {
  if (ENABLED.includes("*") || ENABLED.includes(ns)) console.log(`[${ns}]`, ...args);
}
