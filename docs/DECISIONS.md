# Decisions log

Decisions made after the playbooks were written. When this file disagrees with a playbook, **this file wins** (newest first inside each section).

## 2026-11-12 (Wali, build session)

### Stripe
1. **Wrong account.** The Stripe test account connected so far (`acct_1TlGIk…`) is **not Eryn's**. Create nothing in it. Wait for access to Eryn's own account. Its publishable key (`pk_test_51TlGIk…`) is not used either.
2. **Tax.** No GST/QST registrations yet. Stripe Tax stays on but collects nothing until Eryn gives her real numbers.
3. **Upsell 2 (Une saison complète, CA$97).** Create the price in Eryn's account, but keep it **inactive**. In the funnel, `season97` stays `enabled: false` in `config/offers.json`, so buyers skip that page.
4. **Statement descriptor:** `MAMANDANSE MAMADANCES` (21 characters, under Stripe's 22 limit). Set in Eryn's Stripe public details.
5. **Refund terms:** 30 days, money back. Confirmed.
6. **Support email:** eryn@mamadances.com
7. **Live key:** goes only in Vercel production environment variables, later. Never in the repo or chat.

### Delivery (Kajabi)
8. **v1 has no Kajabi call.** On `payment_intent.succeeded` the webhook saves the order with status `pending_access` and notifies Eryn. She grants access by hand (Job 1).
9. A slot is kept for later: if `KAJABI_GRANT_URL` is set (Kajabi activation URL or Zapier hook), the webhook also posts the order there.
10. **Access timing: instant** (Operator Playbook 5.1, Issue 1, Option B). The pages say access arrives by email right after the purchase. That promise is only true with automatic Kajabi access, so a production build is blocked until `KAJABI_GRANT_URL` is set (copy rule 10). Until then, Eryn must not launch on manual access.

### Hosting
11. **Domain:** `go.mamadances.com`, set up after onboarding.
12. **No Vercel work yet.** The code is ready for Vercel, but nothing is created or deployed until Eryn types "deploy".

### Ads
13. **Do not target France.** Ad sets: Quebec (FR) and rest of Canada (EN). Prices are CAD only.

### Funnel
14. **Downsell [CONFIRM].** The playbooks define no downsell. To avoid inventing a price, the downsell re-offers an existing product at its existing price: **13 objets / 13 Simple Props, CA$17**, shown only to buyers who skipped bump 1, after they decline the last upsell. Turn it off with `enabled: false` on `props17_downsell` in `config/offers.json`.
15. **Testimonials** stay hidden until Eryn confirms permission for each one (the page renders the section only when the list is not empty).
16. **Video language** (Operator Playbook 5.1, Issue 2) is still open. The FAQ answer about language is marked [CONFIRM] and the build lists it.
17. **Photo and logo** added: `src/assets/img/eryn.jpg` (Eryn) and `src/assets/img/logo-sm.png` (one bilingual MamaDances / MamanDanse logo, used in both languages). Photographer credit still to confirm.
