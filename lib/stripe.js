import Stripe from "stripe";
import { HttpError } from "./http.js";

let client = null;

export function stripe() {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new HttpError(503, "Payments are not configured");
  client = new Stripe(key, { maxNetworkRetries: 2 });
  return client;
}

// Tests swap in a fake client.
export function setStripe(fake) {
  client = fake;
}
