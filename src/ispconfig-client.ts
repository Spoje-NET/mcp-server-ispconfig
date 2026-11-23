/**
 * ISPConfig 3 REST API client.
 *
 * The ISPConfig REST API uses JSON over HTTPS:
 *   POST https://{host}:8080/remote/json.php?{method_name}
 *
 * Authentication returns a session_id that must be passed to every call.
 */

import { Agent, type Dispatcher } from "undici";

export interface ISPConfigOptions {
  url: string; // e.g. https://ispconfig.example.com:8080
  username: string;
  password: string;
  /**
   * Skip TLS certificate verification (self-signed certs).
   * Scoped to THIS client's connections only via a dedicated dispatcher,
   * never process-global. Default: false.
   */
  insecure?: boolean;
  /** Timeout of one request in milliseconds. Default: 30000. */
  timeoutMs?: number;
}

/** Upper bound of one API response body. */
export const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

/** Error whose message is already safe to show. */
class HttpError extends Error {}

export class ISPConfigClient {
  private url: string;
  private username: string;
  private password: string;
  private sessionId: string | null = null;
  private insecure: boolean;
  private timeoutMs: number;
  /** Per-client undici dispatcher. Only set when insecure=true, so TLS
   * verification is disabled for this client's requests alone. */
  private dispatcher?: Dispatcher;

  constructor(opts: ISPConfigOptions) {
    const parsed = URL.canParse(opts.url) ? new URL(opts.url) : null;
    if (!parsed || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error("ISPConfig URL must be http(s):// and must not contain credentials");
    }
    this.url = opts.url.replace(/\/+$/, "");
    this.username = opts.username;
    this.password = opts.password;
    this.insecure = opts.insecure ?? false;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    if (this.insecure) {
      // Scope certificate bypass to this client only. This does NOT touch
      // NODE_TLS_REJECT_UNAUTHORIZED and therefore does not weaken TLS for
      // any other outbound request in the process.
      this.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    }
  }

  /** Authenticate and obtain a session_id. */
  async login(): Promise<string> {
    const result = await this.rawCall("login", {
      username: this.username,
      password: this.password,
    });
    if (!result || typeof result !== "string") {
      throw new Error("ISPConfig login failed: invalid credentials or unexpected response");
    }
    this.sessionId = result;
    return result;
  }

  /** End the current session. */
  async logout(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.rawCall("logout", { session_id: this.sessionId });
      } finally {
        this.sessionId = null;
      }
    }
  }

  /** Ensure we have a valid session, login if needed. */
  private async ensureSession(): Promise<string> {
    if (!this.sessionId) {
      await this.login();
    }
    return this.sessionId!;
  }

  /**
   * Call any ISPConfig remote API method.
   * Session ID is automatically injected.
   */
  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const sessionId = await this.ensureSession();
    try {
      return await this.rawCall(method, { session_id: sessionId, ...params });
    } catch (err: unknown) {
      // If the session expired, re-login and retry exactly once.
      // Match ISPConfig's session-related fault messages specifically rather
      // than any error text that happens to contain "session".
      if (err instanceof Error && this.isSessionError(err.message)) {
        this.sessionId = null;
        const newSession = await this.ensureSession();
        return await this.rawCall(method, { session_id: newSession, ...params });
      }
      throw err;
    }
  }

  private isSessionError(message: string): boolean {
    const m = message.toLowerCase();
    return (
      m.includes("session_id") ||
      m.includes("session does not exist") ||
      m.includes("session expired") ||
      // Actual ISPConfig wording: "The Session is expired or does not exist."
      m.includes("session is expired") ||
      m.includes("not logged in") ||
      m.includes("no_session")
    );
  }

  /** Read the body up to MAX_RESPONSE_BYTES. */
  private async readBody(response: Response, method: string): Promise<string> {
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of (response.body ?? []) as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > MAX_RESPONSE_BYTES) {
        throw new HttpError(`ISPConfig API response over ${MAX_RESPONSE_BYTES} bytes calling ${method}`);
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  /** Remove credentials from a server-supplied message. */
  private scrub(message: string): string {
    let out = message;
    for (const secret of [this.password, this.sessionId]) {
      if (secret) out = out.split(secret).join("***");
    }
    return out.slice(0, 500);
  }

  /** Low-level API call without session management. */
  private async rawCall(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!/^[a-z][a-z0-9_]*$/.test(method)) throw new Error("Invalid API method name");
    const endpoint = `${this.url}/remote/json.php?${method}`;

    const fetchOpts: RequestInit & { dispatcher?: Dispatcher } = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(this.timeoutMs),
      // A redirect could carry the credentials to another host.
      redirect: "error",
    };
    if (this.dispatcher) {
      fetchOpts.dispatcher = this.dispatcher;
    }

    let response: Response;
    let body: string;
    try {
      response = await fetch(endpoint, fetchOpts);
      // Avoid echoing raw response bodies (may contain sensitive data) into
      // error messages that end up in logs or model context.
      if (!response.ok) {
        await response.body?.cancel();
        throw new HttpError(`ISPConfig API HTTP ${response.status} calling ${method}`);
      }
      body = await this.readBody(response, method);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new Error(`ISPConfig API timed out after ${this.timeoutMs} ms calling ${method}`);
      }
      const code = (err as { cause?: { code?: string } }).cause?.code;
      throw new Error(`ISPConfig API request failed calling ${method}${code ? ` (${code})` : ""}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error(`ISPConfig API returned invalid JSON calling ${method}`);
    }

    // ISPConfig wraps responses in { code: "ok", response: ... }
    if (json && typeof json === "object" && "code" in json) {
      const wrapped = json as { code: string; response?: unknown; message?: string };
      if (wrapped.code === "ok") {
        return wrapped.response;
      }
      if (wrapped.code === "remote_fault") {
        throw new Error(`ISPConfig remote fault calling ${method}: ${this.scrub(wrapped.message ?? "unknown")}`);
      }
    }

    return json;
  }
}
