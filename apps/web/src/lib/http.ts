/**
 * Small HTTP helpers so route handlers stay framework-light and unit-testable
 * with plain `Request`/`Response` objects.
 */

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const errors = {
  unauthorized: (msg = "Authentication required") => new ApiError(401, "UNAUTHORIZED", msg),
  forbidden: (msg = "Forbidden") => new ApiError(403, "FORBIDDEN", msg),
  notFound: (msg = "Not found") => new ApiError(404, "NOT_FOUND", msg),
  badRequest: (msg = "Bad request") => new ApiError(400, "BAD_REQUEST", msg),
  conflict: (msg = "Conflict") => new ApiError(409, "CONFLICT", msg),
};

export function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

/** Wrap an async handler: converts thrown ApiError into a JSON error response. */
export function handle(
  fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> => {
    try {
      return await fn(req, ctx ?? { params: Promise.resolve({}) });
    } catch (e) {
      if (e instanceof ApiError) {
        return json({ error: { code: e.code, message: e.message } }, { status: e.status });
      }
      if (e instanceof SyntaxError) {
        return json({ error: { code: "BAD_JSON", message: "Invalid JSON body" } }, { status: 400 });
      }
      // eslint-disable-next-line no-console
      console.error("Unhandled API error:", e);
      return json(
        { error: { code: "INTERNAL", message: "Internal server error" } },
        { status: 500 },
      );
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// --- cookies -------------------------------------------------------------

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie");
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function serializeCookie(
  name: string,
  value: string,
  opts: { httpOnly?: boolean; sameSite?: "lax" | "strict" | "none"; secure?: boolean; path?: string; maxAge?: number },
): string {
  const segs = [`${name}=${encodeURIComponent(value)}`];
  if (opts.path) segs.push(`Path=${opts.path}`);
  if (opts.maxAge != null) segs.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) segs.push("HttpOnly");
  if (opts.secure) segs.push("Secure");
  if (opts.sameSite) segs.push(`SameSite=${opts.sameSite[0].toUpperCase()}${opts.sameSite.slice(1)}`);
  return segs.join("; ");
}
