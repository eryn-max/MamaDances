# Funnel setup (for Wali)

Nothing here is done yet. Do it in order, after Eryn gives access to **her own** Stripe account and after onboarding. Deploy only when she types "deploy".

## 1. Stripe (Eryn's account, test mode first)
1. Products and CAD prices: Kit 27, Props 17, Carriers 27, Season 97 (**inactive**). The funnel charges amounts from `config/offers.js`, so the price ids are only for reports.
2. Settings, Public details: statement descriptor `MAMANDANSE MAMADANCES`.
3. Stripe Tax: on, **no registrations** until Eryn sends her GST/QST numbers.
4. Turn on email receipts (Settings, Emails, successful payments).
5. Restricted key with **Write** access to: Customers, PaymentIntents, Payment Methods (to reuse the saved card), Webhook Endpoints. **Read** access to: Charges, Refunds.
6. Webhook endpoint `https://go.mamadances.com/api/stripe-webhook` with the events `payment_intent.succeeded` and `charge.refunded`. Copy its signing secret.
7. Payment method domains: add `go.mamadances.com` (Apple Pay, Google Pay).

## 2. Database
Supabase Postgres (project already linked to GitHub).
1. Tables come from `supabase/migrations/`. The GitHub integration applies them, or paste the file once in the SQL editor.
2. Row level security is on with no policies, so the publishable key cannot read buyer data.
3. Copy the **Transaction pooler** connection string (Connect button, port 6543) into Vercel as `DATABASE_URL`, type sensitive.

## 3. Vercel environment variables
See `.env.example`. Preview uses test keys. Production uses live keys. Never put keys in the repo or chat.

## 4. Before "deploy"
```bash
npm test
```
```bash
npm run check:strict
```
A production build (`VERCEL_ENV=production`) runs the strict check by itself and needs a `pk_live_` key, so placeholders cannot go live by mistake.

## 5. Test every buying path (test mode)
Card `4242 4242 4242 4242`; 3D Secure card `4000 0027 6000 3184`; declined card `4000 0000 0000 0002`.
- No bumps: carriers upsell, props downsell, thank-you.
- Bump 2 only: props downsell, thank-you.
- Both bumps: thank-you.
- Yes on an upsell, with a 3D Secure card.
- Check: one order row per charge, status `pending_access`, Eryn gets one notice per charge.
