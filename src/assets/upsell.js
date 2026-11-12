// Upsell and downsell pages: one click charges the card saved at checkout.
import { MD, session, track, post, stripeClient, showStatus } from "./common.js";
import { nextStep, productOf } from "./flow.js";

const box = document.querySelector("[data-offer]");
const offerKey = box.dataset.offer;
const yes = box.querySelector("[data-yes]");
const no = box.querySelector("[data-no]");
const status = box.querySelector(".status");
const T = MD.t.upsell;
const cfg = { offers: MD.offers, flow: MD.flow };
const order = session.get("md_order");

function go(owned) {
  location.assign(MD.urls[nextStep(owned, offerKey, cfg)]);
}

if (!order || !order.clientSecret) {
  // Opened without a fresh checkout (new tab, old link). Never charge blindly.
  yes.hidden = true;
  no.textContent = MD.t.common.continue;
  showStatus(status, T.noOrder);
  no.addEventListener("click", () => location.assign(MD.urls.thanks));
} else {
  const owned = order.owned || ["kit27"];
  // Skip this page if it no longer applies (back button, refresh after buying).
  if (nextStep(owned, MD.flow[MD.flow.indexOf(offerKey) - 1] ?? null, cfg) !== offerKey) go(owned);

  no.addEventListener("click", () => go(owned));
  yes.addEventListener("click", async () => {
    yes.disabled = true;
    no.disabled = true;
    showStatus(status, T.processing);
    try {
      let r = await post("/api/upsell", { clientSecret: order.clientSecret, offer: offerKey });
      if (r.status === "requires_action") {
        const stripe = stripeClient();
        const res = stripe ? await stripe.handleNextAction({ clientSecret: r.clientSecret }) : { error: true };
        r = res.error || res.paymentIntent?.status !== "succeeded" ? { status: "failed" } : { status: "succeeded", product: r.product, paymentIntentId: r.paymentIntentId };
      }
      if (r.status !== "succeeded") throw new Error("failed");
      const product = r.product || productOf(offerKey, MD.offers);
      order.owned = [...owned, product];
      order.lines = [...(order.lines || []), [product, MD.offers[offerKey].amount]];
      order.total = (order.total || 0) + MD.offers[offerKey].amount;
      session.set("md_order", order);
      track("Purchase", { value: MD.offers[offerKey].amount / 100, currency: "CAD", content_ids: [product], content_type: "product" }, r.paymentIntentId);
      showStatus(status, T.added);
      setTimeout(() => go(order.owned), 700);
    } catch {
      showStatus(status, T.failed, true);
      yes.hidden = true;
      no.disabled = false;
      no.textContent = MD.t.common.continue;
    }
  });
}
