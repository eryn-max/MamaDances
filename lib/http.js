export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function readJson(request, maxBytes = 20000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "Too large");
  try {
    const body = JSON.parse(text || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, "Bad JSON");
  }
}

// Wraps a handler(body) -> result into a Vercel Web-style POST function.
export function postHandler(fn) {
  return async function POST(request) {
    try {
      const body = await readJson(request);
      return json(200, await fn(body, request));
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message });
      console.error(err);
      return json(500, { error: "Server error" });
    }
  };
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
export function cleanEmail(v) {
  const e = String(v || "").trim().toLowerCase();
  if (!EMAIL.test(e)) throw new HttpError(400, "email");
  return e;
}
export function cleanText(v, max, field, required = true) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  if (required && !s) throw new HttpError(400, field);
  return s;
}
export function cleanLang(v) {
  return v === "en" ? "en" : "fr";
}
