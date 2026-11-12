# MamaDances funnel

The CA$27 first-class kit funnel for teachers, in French (default) and English.

| Page | FR | EN |
|---|---|---|
| Page 1 + checkout with 2 bumps | `/fr/` | `/en/` |
| Upsell 1: carriers (only if bump 2 skipped) | `/fr/offre-porte-bebe/` | `/en/carriers-offer/` |
| Upsell 2: full season, CA$97 (off for now) | `/fr/offre-saison/` | `/en/season-offer/` |
| Downsell: 13 props, CA$17 (only if bump 1 skipped) | `/fr/offre-objets/` | `/en/props-offer/` |
| Thank you | `/fr/merci/` | `/en/thank-you/` |
| Montreal application | `/fr/candidature/` | `/en/apply/` |
| Terms, privacy | `/fr/conditions/`, `/fr/confidentialite/` | `/en/terms/`, `/en/privacy/` |

- Words: `copy/fr.json`, `copy/en.json`. Offers and prices: `config/offers.js`. Photos, video, logo: `config/site.js`.
- Server: `api/checkout.js`, `api/upsell.js`, `api/stripe-webhook.js`, `api/apply.js` (Vercel Functions).
- Rules for the AI operator: `CLAUDE.md`. Business facts: `docs/`. Latest decisions: `docs/DECISIONS.md`. Setup: `docs/SETUP.md`.

```bash
npm install
```
```bash
npm run dev
```
```bash
npm test
```
```bash
npm run check
```
