export class SDKError extends Error { code: string; cause?: unknown;
  constructor(code: string, message: string, cause?: unknown) { super(message); this.code = code; this.cause = cause; }
}
export const ERR = {
  ARTIFACT_MISSING: "ARTIFACT_MISSING",
  ARTIFACT_INTEGRITY: "ARTIFACT_INTEGRITY",
  RPC_RETRY_EXHAUSTED: "RPC_RETRY_EXHAUSTED",
  ENCODING_MISMATCH: "ENCODING_MISMATCH",
  BAD_PUBLIC_SIGNALS: "BAD_PUBLIC_SIGNALS",
} as const;
