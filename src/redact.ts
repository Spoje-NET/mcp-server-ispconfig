export const REDACTED = "***REDACTED***";

/** Keys whose values are secrets (passwords, hashes, private keys). */
export function isSecretKey(key: string): boolean {
  return /pass|secret|(^|_)key$|dkim_private|id_rsa|otp_data|tfa_data/i.test(key);
}

/** Recursively replace secret-looking fields (non-mutating). */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSecretKey(k) && v !== "" && v != null ? REDACTED : redact(v);
    }
    return out;
  }
  return value;
}

/** Render an API result for the model, without secrets. */
export function toJson(value: unknown): string {
  return JSON.stringify(redact(value), null, 2) ?? "null";
}

/** True when a value contains the redaction placeholder anywhere. */
export function containsRedacted(value: unknown): boolean {
  if (typeof value === "string") return value.includes(REDACTED);
  if (value && typeof value === "object") return Object.values(value).some(containsRedacted);
  return false;
}
