import { test } from "node:test";
import assert from "node:assert/strict";
import offersConfig from "../config/offers.js";
import { nextStep, frontTotal, validBumps } from "../lib/flow.js";
import { loadCopy, checkCopy } from "../scripts/check.mjs";
import { setStripe } from "../lib/stripe.js";
import { setDb } from "../lib/db.js";
import { checkout, upsell, handleStripeEvent, apply } from "../lib/handlers.js";
import { orderChecklist } from "../lib/notify.js";

const cfg = (patch = {}) => {
  const c = structuredClone(offersConfig);
  for (const [k, v] of Object.entries(patch)) Object.assign(c.offers[k], v);
  return c;
};

test("copy files: same keys, no dashes, no hype words", () => {
  assert.deepEqual(checkCopy(loadCopy()), []);
});

test("copy check catches a missing key, a dash and a banned word", () => {
  const copy = loadCopy();
  copy.en.home.pill = "Teachers — the secret";
  delete copy.fr.home.sub;
  const errs = checkCopy(copy);
  assert.ok(errs.some((e) => e.includes("Key missing in fr.json: home.sub")));
  assert.ok(errs.some((e) => e.includes("dash")));
  assert.ok(errs.some((e) => e.includes("banned")));
});

test("totals are computed from config, in cents", () => {
  assert.equal(frontTotal([], offersConfig), 2700);
  assert.equal(frontTotal(["props17"], offersConfig), 4400);
  assert.equal(frontTotal(["props17", "carriers27"], offersConfig), 7100);
});

test("only enabled bumps are accepted", () => {
  assert.deepEqual(validBumps(["props17", "props17"], offersConfig), ["props17"]);
  assert.equal(validBumps(["season97"], offersConfig), null);
  assert.equal(validBumps("props17", offersConfig), null);
});

test("flow with season97 off (today)", () => {
  // Skipped both bumps: carriers upsell, then props downsell, then thanks.
  assert.equal(nextStep(["kit27"], null, offersConfig), "carriers27_upsell");
  assert.equal(nextStep(["kit27"], "carriers27_upsell", offersConfig), "props17_downsell");
  assert.equal(nextStep(["kit27"], "props17_downsell", offersConfig), "thanks");
  // Took bump 2: no carriers upsell.
  assert.equal(nextStep(["kit27", "carriers27"], null, offersConfig), "props17_downsell");
  // Took both bumps: straight to thanks.
  assert.equal(nextStep(["kit27", "props17", "carriers27"], null, offersConfig), "thanks");
});

test("flow with season97 on", () => {
  const c = cfg({ season97: { enabled: true } });
  assert.equal(nextStep(["kit27", "props17", "carriers27"], null, c), "season97");
  assert.equal(nextStep(["kit27"], "carriers27_upsell", c), "season97");
  assert.equal(nextStep(["kit27"], "season97", c), "props17_downsell");
  assert.equal(nextStep(["kit27", "props17"], "season97", c), "thanks");
});

// ---------- server handlers with a fake Stripe ----------
function fakeStripe(state = {}) {
  const calls = [];
  const s = {
    calls,
    customers: {
      list: async () => ({ data: state.customer ? [state.customer] : [] }),
      create: async (p) => (calls.push(["customers.create", p]), { id: "cus_1", ...p }),
      update: async (id, p) => (calls.push(["customers.update", id, p]), { id, ...p }),
    },
    paymentIntents: {
      create: async (p, o) => {
        calls.push(["pi.create", p, o]);
        if (state.fail) { const e = new Error("declined"); e.type = "StripeCardError"; throw e; }
        return { id: "pi_new", client_secret: "pi_new_secret_x", status: state.upsellStatus || "succeeded", ...p };
      },
      retrieve: async (id) => state.front && state.front.id === id ? state.front : Promise.reject(new Error("nope")),
    },
  };
  return s;
}

const front = (over = {}) => ({
  id: "pi_front",
  client_secret: "pi_front_secret_abc",
  status: "succeeded",
  created: Math.floor(Date.now() / 1000) - 60,
  customer: "cus_1",
  payment_method: "pm_1",
  receipt_email: "a@example.com",
  metadata: { funnel: "md-v1", step: "front", items: "kit27", lang: "fr", variant: "a", first_name: "Ana" },
  ...over,
});

test("checkout: server sets the amount and saves the card", async () => {
  const s = fakeStripe();
  setStripe(s);
  const req = new Request("https://x.test", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8", "user-agent": "UA" } });
  const r = await checkout({ email: "A@Example.com ", firstName: "Ana", lang: "fr", bumps: ["props17"], checkoutId: "abcdefgh-1", utm: { utm_source: "fb", evil: "x" }, meta: { fbp: "fb.1.1700000000.123", fbc: "javascript:x" } }, req);
  assert.equal(r.amount, 4400);
  const [, p, o] = s.calls.find((c) => c[0] === "pi.create");
  assert.equal(p.amount, 4400);
  assert.equal(p.currency, "cad");
  assert.equal(p.setup_future_usage, "off_session");
  assert.equal(p.metadata.items, "kit27,props17");
  assert.equal(p.metadata.utm_source, "fb");
  assert.equal(p.metadata.evil, undefined);
  assert.equal(p.metadata.fbp, "fb.1.1700000000.123");
  assert.equal(p.metadata.fbc, undefined);
  assert.equal(p.metadata.client_ip, "1.2.3.4");
  assert.equal(p.metadata.client_ua, "UA");
  assert.equal(p.receipt_email, "a@example.com");
  assert.match(o.idempotencyKey, /^md-checkout-abcdefgh-1-/);
});

test("checkout: rejects bad email and unknown bumps", async () => {
  setStripe(fakeStripe());
  await assert.rejects(checkout({ email: "nope", firstName: "A", checkoutId: "abcdefgh" }), { status: 400 });
  await assert.rejects(checkout({ email: "a@b.co", firstName: "A", bumps: ["season97"], checkoutId: "abcdefgh" }), { status: 400 });
});

test("upsell: charges the saved card once per offer", async () => {
  const s = fakeStripe({ front: front() });
  setStripe(s);
  const r = await upsell({ clientSecret: "pi_front_secret_abc", offer: "carriers27_upsell" });
  assert.deepEqual(r, { status: "succeeded", product: "carriers27", paymentIntentId: "pi_new" });
  const [, p, o] = s.calls.find((c) => c[0] === "pi.create");
  assert.equal(p.amount, 2700);
  assert.equal(p.payment_method, "pm_1");
  assert.equal(p.confirm, true);
  assert.equal(p.metadata.parent_pi, "pi_front");
  assert.equal(o.idempotencyKey, "md-upsell-pi_front-carriers27_upsell");
});

test("upsell: guards", async () => {
  setStripe(fakeStripe({ front: front() }));
  await assert.rejects(upsell({ clientSecret: "pi_front_secret_WRONG", offer: "carriers27_upsell" }), { status: 403 });
  await assert.rejects(upsell({ clientSecret: "pi_front_secret_abc", offer: "season97" }), { status: 400 }); // disabled
  await assert.rejects(upsell({ clientSecret: "pi_front_secret_abc", offer: "kit27" }), { status: 400 });
  setStripe(fakeStripe({ front: front({ metadata: { ...front().metadata, items: "kit27,carriers27" } }) }));
  await assert.rejects(upsell({ clientSecret: "pi_front_secret_abc", offer: "carriers27_upsell" }), { status: 409 });
  setStripe(fakeStripe({ front: front({ created: Math.floor(Date.now() / 1000) - 7200 }) }));
  await assert.rejects(upsell({ clientSecret: "pi_front_secret_abc", offer: "carriers27_upsell" }), { status: 410 });
  setStripe(fakeStripe({ front: front({ status: "requires_payment_method" }) }));
  await assert.rejects(upsell({ clientSecret: "pi_front_secret_abc", offer: "carriers27_upsell" }), { status: 409 });
});

test("upsell: 3D Secure and declines", async () => {
  setStripe(fakeStripe({ front: front(), upsellStatus: "requires_action" }));
  const r = await upsell({ clientSecret: "pi_front_secret_abc", offer: "props17_downsell" });
  assert.equal(r.status, "requires_action");
  assert.equal(r.clientSecret, "pi_new_secret_x");
  setStripe(fakeStripe({ front: front(), fail: true }));
  assert.deepEqual(await upsell({ clientSecret: "pi_front_secret_abc", offer: "props17_downsell" }), { status: "failed" });
});

test("webhook: saves pending_access order, notifies once, Kajabi slot skipped", async () => {
  const saved = new Map();
  const fakeSql = async (strings, ...vals) => {
    const q = strings.join("?");
    if (q.includes("insert into orders")) {
      if (saved.has(vals[0])) return [];
      saved.set(vals[0], vals);
      return [{ id: vals[0] }];
    }
    return [];
  };
  setDb(fakeSql);
  delete process.env.KAJABI_GRANT_URL;
  process.env.NOTIFY_WEBHOOK_URL = "https://hooks.example.test/x";
  const sent = [];
  const fetchImpl = async (url, init) => (sent.push([url, JSON.parse(init.body)]), { ok: true });
  const event = { type: "payment_intent.succeeded", data: { object: { ...front(), amount: 4400, amount_received: 4400, currency: "cad", metadata: { ...front().metadata, items: "kit27,props17" } } } };

  const r1 = await handleStripeEvent(event, fetchImpl);
  assert.deepEqual(r1, { saved: true, notified: true });
  assert.equal(sent.length, 1);
  assert.match(sent[0][1].text, /Grant offer: MD Kit 27/);
  assert.match(sent[0][1].text, /md-props17, md-lang-fr/);

  const r2 = await handleStripeEvent(event, fetchImpl); // Stripe retry
  assert.deepEqual(r2, { duplicate: true });
  assert.equal(sent.length, 1);

  const other = await handleStripeEvent({ type: "payment_intent.succeeded", data: { object: { ...front(), metadata: {} } } }, fetchImpl);
  assert.deepEqual(other, { ignored: true });
  delete process.env.NOTIFY_WEBHOOK_URL;
  setDb(undefined);
});

test("webhook: Kajabi slot posts when KAJABI_GRANT_URL is set", async () => {
  setDb(null);
  process.env.KAJABI_GRANT_URL = "https://kajabi.example.test/grant";
  const sent = [];
  const fetchImpl = async (url, init) => (sent.push([url, JSON.parse(init.body)]), { ok: true });
  await handleStripeEvent({ type: "payment_intent.succeeded", data: { object: { ...front(), amount: 2700, currency: "cad" } } }, fetchImpl);
  const k = sent.find(([u]) => u.includes("kajabi"));
  assert.deepEqual(k[1].offers, ["MD Kit 27"]);
  assert.deepEqual(k[1].tags, ["md-kit27", "md-lang-fr"]);
  delete process.env.KAJABI_GRANT_URL;
  setDb(undefined);
});

test("checklist for an upsell uses the base product", () => {
  const text = orderChecklist({ id: "pi_x", step: "carriers27_upsell", items: "carriers27", amount: 2700, email: "a@b.co", firstName: "Ana", lang: "en" });
  assert.match(text, /Grant offer: MD Carriers 27/);
  assert.match(text, /md-carriers27, md-lang-en/);
});

test("apply: honeypot and validation", async () => {
  setDb(null);
  assert.deepEqual(await apply({ website: "spam" }), { ok: true });
  await assert.rejects(apply({ name: "A", email: "bad", city: "Mtl", teach: "dance" }), { status: 400 });
  const r = await apply({ name: "Ana", email: "a@b.co", city: "Montréal", teach: "Danse", program: "both", lang: "fr" }, async () => ({ ok: true }));
  assert.deepEqual(r, { ok: true });
  setDb(undefined);
});
