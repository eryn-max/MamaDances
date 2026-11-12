// Funnel logic. The api/*.js files are thin wrappers around these, so they can be tested.
import offersConfig from "../config/offers.js";
import { frontTotal, validBumps, productOf } from "./flow.js";
import { HttpError, cleanEmail, cleanText, cleanLang } from "./http.js";
import { stripe } from "./stripe.js";
import { saveOrder, markRefunded, markKajabiPosted, saveApplication } from "./db.js";
import { notify, orderChecklist, postToKajabi } from "./notify.js";
import { safeSend, purchaseEvent, leadEvent } from "./capi.js";

const FUNNEL = "md-v1";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];

function cleanUtm(utm) {
  const out = {};
  if (utm && typeof utm === "object")
    for (const k of UTM_KEYS) if (typeof utm[k] === "string" && utm[k]) out[k] = utm[k].slice(0, 200);
  return out;
}

// Meta Conversions API match keys, kept on the payment for server-side events later.
function metaContext(body, request) {
  const m = body.meta && typeof body.meta === "object" ? body.meta : {};
  const ok = (v) => typeof v === "string" && /^fb\.\d\.\d+\.[A-Za-z0-9_.-]+$/.test(v) && v.length <= 300;
  const out = {};
  if (ok(m.fbp)) out.fbp = m.fbp;
  if (ok(m.fbc)) out.fbc = m.fbc;
  const h = request?.headers;
  const ip = h?.get?.("x-forwarded-for")?.split(",")[0].trim();
  const ua = h?.get?.("user-agent");
  if (ip) out.client_ip = ip.slice(0, 64);
  if (ua) out.client_ua = ua.slice(0, 450);
  return out;
}

function describe(items) {
  return "MamaDances: " + items.join(" + ");
}

// POST /api/checkout
// Front end + bumps, one charge. The card is saved for one-click upsells.
export async function checkout(body, request) {
  const email = cleanEmail(body.email);
  const firstName = cleanText(body.firstName, 60, "firstName");
  const lang = cleanLang(body.lang);
  const variant = body.variant === "b" ? "b" : "a";
  const bumps = validBumps(body.bumps ?? [], offersConfig);
  if (!bumps) throw new HttpError(400, "bumps");
  const checkoutId = cleanText(body.checkoutId, 64, "checkoutId").replace(/[^A-Za-z0-9-]/g, "");
  if (checkoutId.length < 8) throw new HttpError(400, "checkoutId");

  const items = ["kit27", ...bumps];
  const amount = frontTotal(bumps, offersConfig);
  const s = stripe();

  const found = await s.customers.list({ email, limit: 1 });
  let customer = found.data[0];
  if (customer) {
    customer = await s.customers.update(customer.id, { metadata: { lang } });
  } else {
    customer = await s.customers.create({ email, name: firstName, metadata: { lang, funnel: FUNNEL } });
  }

  const pi = await s.paymentIntents.create(
    {
      amount,
      currency: offersConfig.currency,
      customer: customer.id,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      receipt_email: email,
      description: describe(items),
      metadata: { funnel: FUNNEL, step: "front", items: items.join(","), lang, variant, first_name: firstName, ...cleanUtm(body.utm), ...metaContext(body, request) },
    },
    { idempotencyKey: `md-checkout-${checkoutId}-${items.join("_")}` }
  );
  return { clientSecret: pi.client_secret, amount };
}

// POST /api/upsell
// One click: charge the card saved at checkout. The buyer is on the page, so this
// is an on-session charge and 3D Secure can still be shown if the bank asks.
export async function upsell(body, now = Date.now()) {
  const clientSecret = String(body.clientSecret || "");
  const m = clientSecret.match(/^(pi_[A-Za-z0-9]+)_secret_[A-Za-z0-9]+$/);
  if (!m) throw new HttpError(400, "clientSecret");
  const offerKey = String(body.offer || "");
  const offer = offersConfig.offers[offerKey];
  if (!offer || !offer.enabled || !["upsell", "downsell"].includes(offer.role) || !offersConfig.flow.includes(offerKey))
    throw new HttpError(400, "offer");

  const s = stripe();
  const front = await s.paymentIntents.retrieve(m[1]);
  if (front.client_secret !== clientSecret) throw new HttpError(403, "forbidden");
  if (front.metadata?.funnel !== FUNNEL || front.metadata?.step !== "front") throw new HttpError(403, "forbidden");
  if (front.status !== "succeeded") throw new HttpError(409, "front order not paid");
  if (now / 1000 - front.created > offersConfig.upsellWindowMinutes * 60) throw new HttpError(410, "expired");
  if (!front.customer || !front.payment_method) throw new HttpError(409, "no saved card");

  const owned = (front.metadata.items || "").split(",");
  const product = productOf(offerKey, offersConfig.offers);
  if (owned.includes(product)) throw new HttpError(409, "already owned");
  if (offer.showIfMissing && owned.includes(offer.showIfMissing)) throw new HttpError(409, "not offered");

  const md = front.metadata;
  try {
    const pi = await s.paymentIntents.create(
      {
        amount: offer.amount,
        currency: offersConfig.currency,
        customer: typeof front.customer === "string" ? front.customer : front.customer.id,
        payment_method: typeof front.payment_method === "string" ? front.payment_method : front.payment_method.id,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        receipt_email: front.receipt_email || undefined,
        description: describe([product]),
        metadata: {
          funnel: FUNNEL, step: offerKey, parent_pi: front.id, items: product,
          lang: md.lang, variant: md.variant, first_name: md.first_name,
          ...cleanUtm(md),
          ...Object.fromEntries(["fbp", "fbc", "client_ip", "client_ua"].filter((k) => md[k]).map((k) => [k, md[k]])),
        },
      },
      { idempotencyKey: `md-upsell-${front.id}-${offerKey}` }
    );
    if (pi.status === "succeeded") return { status: "succeeded", product, paymentIntentId: pi.id };
    if (pi.status === "requires_action") return { status: "requires_action", clientSecret: pi.client_secret, product, paymentIntentId: pi.id };
    return { status: "failed" };
  } catch (err) {
    if (err && (err.type === "StripeCardError" || err.rawType === "card_error")) return { status: "failed" };
    throw err;
  }
}

function orderFromIntent(pi) {
  const md = pi.metadata || {};
  return {
    id: pi.id,
    parentId: md.parent_pi || null,
    step: md.step || "front",
    items: md.items || "",
    amount: pi.amount_received || pi.amount,
    currency: pi.currency,
    email: pi.receipt_email || "",
    firstName: md.first_name || "",
    lang: md.lang === "en" ? "en" : "fr",
    variant: md.variant || null,
    utm: cleanUtm(md),
  };
}

// POST /api/stripe-webhook
// v1: save the order as "pending_access" and tell Eryn (docs/DECISIONS.md #8, #9).
export async function handleStripeEvent(event, fetchImpl = fetch) {
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    if (pi.metadata?.funnel !== FUNNEL) return { ignored: true };
    const order = orderFromIntent(pi);
    const isNew = await saveOrder(order);
    if (isNew === false) return { duplicate: true };
    await notify(`MamaDances: new order (${order.items})`, orderChecklist(order), { id: order.id, type: "order" }, fetchImpl);
    if (await postToKajabi(order, fetchImpl)) await markKajabiPosted(order.id);
    const capi = await safeSend([purchaseEvent(pi)], fetchImpl);
    return { saved: isNew === true, notified: true, capi };
  }
  if (event.type === "charge.refunded") {
    const pi = event.data.object.payment_intent;
    if (pi) await markRefunded(typeof pi === "string" ? pi : pi.id);
    return { refunded: true };
  }
  return { ignored: true };
}

// POST /api/apply
export async function apply(body, fetchImpl = fetch, request) {
  if (body.website) return { ok: true }; // honeypot: bots fill hidden fields
  const programs = ["mom-baby", "parent-child", "both"];
  const a = {
    lang: cleanLang(body.lang),
    name: cleanText(body.name, 100, "name"),
    email: cleanEmail(body.email),
    city: cleanText(body.city, 100, "city"),
    teach: cleanText(body.teach, 500, "teach"),
    program: programs.includes(body.program) ? body.program : "both",
    why: cleanText(body.why, 1500, "why", false),
    dates: cleanText(body.dates, 300, "dates", false),
  };
  await saveApplication(a);
  const text = [
    `New Montreal application (${a.lang === "en" ? "English" : "French"})`,
    `Name: ${a.name}`, `Email: ${a.email}`, `City: ${a.city}`,
    `Teaches: ${a.teach}`, `Program: ${a.program}`, `Why: ${a.why}`, `Dates: ${a.dates}`,
    "", "Next: add her in Kajabi with the tag md-applicant, then paste this to Claude (Job 6).",
  ].join("\n");
  await notify("MamaDances: new Montreal application", text, { type: "application" }, fetchImpl);
  await safeSend([leadEvent(a, request)], fetchImpl);
  return { ok: true };
}
