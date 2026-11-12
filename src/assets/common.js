// Small helpers shared by the page scripts.
export const MD = window.MD;

// Storage can throw (private mode, blocked cookies). Never let it break a page.
export const session = {
  get(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch { return null; }
  },
  set(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
};

export function setCookie(name, value, days) {
  try { document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${days * 86400};samesite=lax`; } catch { /* ignore */ }
}
export function getCookie(name) {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

export function variant() {
  return document.documentElement.getAttribute("data-v") === "b" ? "b" : "a";
}

export function track(event, data) {
  try { if (MD.pixel && window.fbq) window.fbq("track", event, data); } catch { /* ignore */ }
}

export function money(cents) {
  const n = (cents / 100).toFixed(cents % 100 ? 2 : 0);
  return MD.lang === "fr" ? `${n.replace(".", ",")} $` : `CA$${n}`;
}

export async function post(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await r.json(); } catch { /* ignore */ }
  if (!r.ok) {
    const err = new Error(data.error || `HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return data;
}

export function stripeClient() {
  if (!MD.pk || !window.Stripe) return null;
  if (!window.__mdStripe) window.__mdStripe = window.Stripe(MD.pk, { locale: MD.lang });
  return window.__mdStripe;
}

export function showStatus(el, text, isError) {
  if (!el) return;
  el.textContent = text;
  el.classList.add("show");
  el.classList.toggle("error", !!isError);
}
