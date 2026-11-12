// Meta Conversions API: server-side copy of the browser events.
// Same event_id as the pixel (the Stripe PaymentIntent id), so Meta counts each sale once.
// Env: META_CAPI_TOKEN (Vercel only, never in the repo), META_TEST_EVENT_CODE (optional, for Events Manager tests).
// Pixel id comes from config/site.js unless META_PIXEL_ID is set.
import { createHash } from "node:crypto";
import site from "../config/site.js";

const API = "https://graph.facebook.com/v21.0";
const sha = (v) => createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");

export function purchaseEvent(pi, now = Date.now()) {
  const md = pi.metadata || {};
  const items = (md.items || "").split(",").filter(Boolean);
  const lang = md.lang === "en" ? "en" : "fr";
  const user = {};
  if (pi.receipt_email) user.em = [sha(pi.receipt_email)];
  if (md.first_name) user.fn = [sha(md.first_name)];
  if (md.client_ip) user.client_ip_address = md.client_ip;
  if (md.client_ua) user.client_user_agent = md.client_ua;
  if (md.fbp) user.fbp = md.fbp;
  if (md.fbc) user.fbc = md.fbc;
  return {
    event_name: "Purchase",
    event_time: Math.floor((pi.created ? pi.created * 1000 : now) / 1000),
    event_id: pi.id,
    action_source: "website",
    event_source_url: `https://${site.domain}/${lang}/`,
    user_data: user,
    custom_data: {
      currency: (pi.currency || "cad").toUpperCase(),
      value: (pi.amount_received || pi.amount) / 100,
      content_ids: items,
      content_type: "product",
      order_id: md.parent_pi || pi.id,
    },
  };
}

export function leadEvent(a, request, now = Date.now()) {
  const h = request?.headers;
  const user = { em: [sha(a.email)] };
  const ip = h?.get?.("x-forwarded-for")?.split(",")[0].trim();
  const ua = h?.get?.("user-agent");
  if (ip) user.client_ip_address = ip;
  if (ua) user.client_user_agent = ua;
  return {
    event_name: "Lead",
    event_time: Math.floor(now / 1000),
    action_source: "website",
    event_source_url: `https://${site.domain}/${a.lang}/`,
    user_data: user,
    custom_data: { content_name: "montreal-application" },
  };
}

export async function sendEvents(events, fetchImpl = fetch) {
  const token = process.env.META_CAPI_TOKEN;
  const pixel = process.env.META_PIXEL_ID || site.metaPixelId;
  if (!token || !pixel) return false;
  const body = { data: events };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
  const r = await fetchImpl(`${API}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`CAPI ${r.status}`);
  return true;
}

// Never let tracking break an order or an application.
export async function safeSend(events, fetchImpl = fetch) {
  try {
    return await sendEvents(events, fetchImpl);
  } catch (err) {
    console.error("capi", err.message);
    return false;
  }
}
