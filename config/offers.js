// Prices are in cents, CAD. The server always computes totals from this file.
// enabled:false hides an offer from the funnel. Items marked [CONFIRM] need Eryn's yes.
export default {
  "currency": "cad",
  "offers": {
    "kit27": {
      "role": "front",
      "amount": 2700,
      "enabled": true,
      "stripePriceEnv": "STRIPE_PRICE_KIT27",
      "kajabiOffer": "MD Kit 27",
      "tag": "md-kit27"
    },
    "props17": {
      "role": "bump",
      "amount": 1700,
      "enabled": true,
      "stripePriceEnv": "STRIPE_PRICE_PROPS17",
      "kajabiOffer": "MD Props 17",
      "tag": "md-props17"
    },
    "carriers27": {
      "role": "bump",
      "amount": 2700,
      "enabled": true,
      "stripePriceEnv": "STRIPE_PRICE_CARRIERS27",
      "kajabiOffer": "MD Carriers 27",
      "tag": "md-carriers27"
    },
    "carriers27_upsell": {
      "role": "upsell",
      "product": "carriers27",
      "amount": 2700,
      "enabled": true,
      "showIfMissing": "carriers27",
      "stripePriceEnv": "STRIPE_PRICE_CARRIERS27",
      "kajabiOffer": "MD Carriers 27",
      "tag": "md-carriers27"
    },
    "season97": {
      "role": "upsell",
      "amount": 9700,
      "enabled": false,
      "note": "[CONFIRM] Price is created inactive in Stripe. Keep false until Eryn says yes.",
      "stripePriceEnv": "STRIPE_PRICE_SEASON97",
      "kajabiOffer": "MD Season 97",
      "tag": "md-season97"
    },
    "props17_downsell": {
      "role": "downsell",
      "product": "props17",
      "amount": 1700,
      "enabled": true,
      "showIfMissing": "props17",
      "note": "[CONFIRM] Downsell re-offers the existing 13 props guide at its existing price. See docs/DECISIONS.md #14.",
      "stripePriceEnv": "STRIPE_PRICE_PROPS17",
      "kajabiOffer": "MD Props 17",
      "tag": "md-props17"
    }
  },
  "flow": [
    "carriers27_upsell",
    "season97",
    "props17_downsell"
  ],
  "upsellWindowMinutes": 60
};
