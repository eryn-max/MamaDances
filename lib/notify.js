// Tells Eryn about a new order or application.
// Channels (any or all, set in Vercel env):
//   RESEND_API_KEY + NOTIFY_EMAIL_FROM + NOTIFY_EMAIL_TO  -> email
//   NOTIFY_WEBHOOK_URL                                     -> JSON POST (Zapier, Make, Slack...)
// With none set, only the order id is logged (no buyer data in logs).
import offersConfig from "../config/offers.js";

const productInfo = Object.fromEntries(
  Object.entries(offersConfig.offers)
    .filter(([, o]) => !o.product)
    .map(([k, o]) => [k, { kajabiOffer: o.kajabiOffer, tag: o.tag }])
);

function tagsFor(o) {
  const items = o.items.split(",").filter(Boolean);
  return [...items.map((i) => productInfo[i]?.tag || i), `md-lang-${o.lang}`];
}

export function orderChecklist(o) {
  const items = o.items.split(",").filter(Boolean);
  return [
    `New order, pending access: ${o.firstName || "(no name)"} (${o.email}), ${o.lang === "en" ? "English" : "French"}`,
    `Step: ${o.step}. Amount: CA$${(o.amount / 100).toFixed(2)}. Stripe: ${o.id}`,
    "",
    "[ ] Add or find her in Kajabi Contacts",
    ...items.map((i) => `[ ] Grant offer: ${productInfo[i]?.kajabiOffer || i}`),
    `[ ] Add tags: ${tagsFor(o).join(", ")}`,
    "[ ] Mark done",
  ].join("\n");
}

export async function notify(subject, text, data, fetchImpl = fetch) {
  const sent = [];
  const { RESEND_API_KEY, NOTIFY_EMAIL_FROM, NOTIFY_EMAIL_TO, NOTIFY_WEBHOOK_URL } = process.env;
  if (RESEND_API_KEY && NOTIFY_EMAIL_FROM && NOTIFY_EMAIL_TO) {
    const r = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: NOTIFY_EMAIL_FROM, to: NOTIFY_EMAIL_TO.split(","), subject, text }),
    });
    if (!r.ok) throw new Error(`Email notify failed: ${r.status}`);
    sent.push("email");
  }
  if (NOTIFY_WEBHOOK_URL) {
    const r = await fetchImpl(NOTIFY_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, text, ...data }),
    });
    if (!r.ok) throw new Error(`Webhook notify failed: ${r.status}`);
    sent.push("webhook");
  }
  if (!sent.length) console.log(`notify (no channel set): ${subject} [${data?.id || ""}]`);
  return sent;
}

// Slot for later automatic access (docs/DECISIONS.md #9). Skipped while KAJABI_GRANT_URL is empty.
export async function postToKajabi(o, fetchImpl = fetch) {
  const url = process.env.KAJABI_GRANT_URL;
  if (!url) return false;
  const items = o.items.split(",").filter(Boolean);
  const r = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: o.email,
      first_name: o.firstName,
      lang: o.lang,
      order_id: o.id,
      offers: items.map((i) => productInfo[i]?.kajabiOffer || i),
      tags: tagsFor(o),
    }),
  });
  if (!r.ok) throw new Error(`Kajabi grant failed: ${r.status}`);
  return true;
}
