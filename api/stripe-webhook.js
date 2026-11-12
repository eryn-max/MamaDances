import { json } from "../lib/http.js";
import { stripe } from "../lib/stripe.js";
import { handleStripeEvent } from "../lib/handlers.js";

// Stripe sends: payment_intent.succeeded, charge.refunded.
// A non-2xx answer makes Stripe retry, so errors return 500 on purpose.
export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json(503, { error: "Webhook not configured" });
  const raw = await request.text();
  let event;
  try {
    event = await stripe().webhooks.constructEventAsync(raw, request.headers.get("stripe-signature") || "", secret);
  } catch {
    return json(400, { error: "Bad signature" });
  }
  try {
    return json(200, await handleStripeEvent(event));
  } catch (err) {
    console.error("webhook", event.id, err.message);
    return json(500, { error: "Handler failed" });
  }
}
