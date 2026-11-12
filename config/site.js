// Site settings that are not copy. Items left null are listed by `npm run check`
// and block `npm run check:strict` (run before any deploy).
export default {
  domain: "go.mamadances.com",
  // Meta pixel "MamaDances's Pixel" (ad account act_470740090374093). Not a secret.
  metaPixelId: "1081343158921496",
  supportEmail: "eryn@mamadances.com",
  timezone: "America/Toronto",
  // Page 1 video per language (YouTube/Vimeo embed URL or an .mp4 in /assets). [CONFIRM]
  video: { fr: null, en: null },
  // Real files from Eryn. [CONFIRM file]
  logo: { fr: "/assets/img/logo-sm.png", en: "/assets/img/logo-sm.png" }, // one bilingual logo
  erynPhoto: "/assets/img/eryn.jpg",
  kitCover: null,
  // Kajabi login page for the thank-you button. [CONFIRM]
  kajabiLoginUrl: null,
  // Pages, by language. The toggle keeps the same page.
  pages: {
    home: { fr: "", en: "" },
    carriers27_upsell: { fr: "offre-porte-bebe", en: "carriers-offer" },
    season97: { fr: "offre-saison", en: "season-offer" },
    props17_downsell: { fr: "offre-objets", en: "props-offer" },
    thanks: { fr: "merci", en: "thank-you" },
    apply: { fr: "candidature", en: "apply" },
    terms: { fr: "conditions", en: "terms" },
    privacy: { fr: "confidentialite", en: "privacy" }
  }
};
