// Page 1 checkout: modal, 2 order bumps, live total, one Stripe charge.
// The card is saved (setup_future_usage) so the next pages can add items in one click.
import { MD, session, variant, track, money, post, stripeClient } from "./common.js";
import { frontTotal, nextStep } from "./flow.js";

const modal = document.getElementById("checkout");
const form = document.getElementById("checkout-form");
const payBtn = document.getElementById("pay-btn");
const T = MD.t.checkout;
const cfg = { offers: MD.offers, flow: MD.flow };

let elements = null;
let opened = false;
let busy = false;
const checkoutId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^A-Za-z0-9-]/g, "");

function bumps() {
  return [...form.querySelectorAll('input[name="bump"]:checked')].map((i) => i.value);
}

function refreshTotal() {
  const chosen = bumps();
  const total = frontTotal(chosen, cfg);
  form.querySelectorAll("[data-total]").forEach((el) => (el.textContent = money(total)));
  form.querySelectorAll("[data-line]").forEach((li) => (li.hidden = !chosen.includes(li.dataset.line)));
  if (elements) elements.update({ amount: total });
  return total;
}

function mountStripe() {
  const stripe = stripeClient();
  if (!stripe || elements) return;
  elements = stripe.elements({
    mode: "payment",
    amount: frontTotal(bumps(), cfg),
    currency: MD.currency,
    setupFutureUsage: "off_session",
    appearance: {
      theme: "stripe",
      variables: { colorPrimary: "#795A94", colorDanger: "#C73D31", colorText: "#2B2433", borderRadius: "10px", fontSizeBase: "16px" },
    },
  });
  elements.create("payment", { layout: "tabs" }).mount("#payment-element");
}

function open() {
  modal.hidden = false;
  modal.classList.add("open");
  document.body.classList.add("modal-open");
  mountStripe();
  if (!opened) {
    opened = true;
    track("InitiateCheckout", { value: frontTotal(bumps(), cfg) / 100, currency: "CAD" });
  }
  setTimeout(() => document.getElementById("co-email").focus(), 50);
}

function close() {
  if (busy) return;
  modal.classList.remove("open");
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function fieldError(name, show, text) {
  const el = form.querySelector(`[data-error="${name}"]`);
  if (!el) return;
  if (text) el.textContent = text;
  el.classList.toggle("show", show);
}

document.querySelectorAll("[data-open-checkout]").forEach((b) => b.addEventListener("click", open));
modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) close(); });
form.querySelectorAll('input[name="bump"]').forEach((i) => i.addEventListener("change", refreshTotal));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const email = form.email.value.trim();
  const firstName = form.firstName.value.trim();
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  fieldError("email", !okEmail);
  fieldError("firstName", !firstName);
  fieldError("card", false);
  if (!okEmail || !firstName) return;

  const stripe = stripeClient();
  if (!stripe || !elements) return;

  busy = true;
  payBtn.disabled = true;
  const label = payBtn.innerHTML;
  payBtn.textContent = T.paying;
  try {
    const { error: submitError } = await elements.submit();
    if (submitError) throw Object.assign(new Error(submitError.message), { shown: true });

    const chosen = bumps();
    const { clientSecret, amount } = await post("/api/checkout", {
      email, firstName, lang: MD.lang, bumps: chosen, variant: variant(),
      utm: session.get("md_utm") || {}, checkoutId,
    });

    const owned = ["kit27", ...chosen];
    const next = MD.urls[nextStep(owned, null, cfg)];
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      redirect: "if_required",
      confirmParams: {
        return_url: location.origin + next,
        receipt_email: email,
        payment_method_data: { billing_details: { email, name: firstName } },
      },
    });
    if (error) throw Object.assign(new Error(error.message || T.errors.card), { shown: true });
    if (paymentIntent && paymentIntent.status !== "succeeded") throw Object.assign(new Error(T.errors.card), { shown: true });

    session.set("md_order", { clientSecret, owned, lang: MD.lang, lines: owned.map((k) => [k, MD.offers[k].amount]), total: amount });
    track("Purchase", { value: amount / 100, currency: "CAD", content_ids: owned });
    location.assign(next);
  } catch (err) {
    fieldError("card", true, err.shown ? err.message : MD.t.common.errorGeneric);
    busy = false;
    payBtn.disabled = false;
    payBtn.innerHTML = label;
    refreshTotal();
  }
});

refreshTotal();
