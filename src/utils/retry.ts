export async function withRetry<T>(fn: () => Promise<T>, opts: { attempts?: number; baseMs?: number } = {}): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const base = opts.baseMs ?? 250;
  let last: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      await new Promise(r => setTimeout(r, base * 2 ** i));
    }
  }
  throw last;
}
