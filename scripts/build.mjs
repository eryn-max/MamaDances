// Builds every funnel page, in French and English, into public/.
//   npm run build
// Env read at build time (all optional for a preview build):
//   STRIPE_PUBLISHABLE_KEY  pk_test_... or pk_live_... from Eryn's Stripe account
//   META_PIXEL_ID           overrides config/site.js metaPixelId (PageView / InitiateCheckout / Purchase / Lead)
// On Vercel production builds (VERCEL_ENV=production) the strict launch check must pass.
import { mkdirSync, rmSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import site from "../config/site.js";
import offersConfig from "../config/offers.js";
import { loadCopy, checkCopy, launchWarnings } from "./check.mjs";

const out = new URL("../public/", import.meta.url);
const LANGS = ["fr", "en"];
const copy = loadCopy();

const errors = checkCopy(copy);
if (errors.length) {
  console.error("Copy errors:\n  " + errors.join("\n  "));
  process.exit(1);
}
const production = process.env.VERCEL_ENV === "production";
const pk = process.env.STRIPE_PUBLISHABLE_KEY || "";
if (production) {
  const w = launchWarnings(copy);
  if (!pk.startsWith("pk_live_")) w.push("STRIPE_PUBLISHABLE_KEY must be a pk_live_ key in production.");
  if (w.length) {
    console.error("Production build blocked. Finish these first:\n  " + w.join("\n  "));
    process.exit(1);
  }
}
if (pk && !/^pk_(test|live)_[A-Za-z0-9]+$/.test(pk)) {
  console.error("STRIPE_PUBLISHABLE_KEY does not look like a publishable key.");
  process.exit(1);
}
const pixelId = process.env.META_PIXEL_ID || site.metaPixelId || "";
const pixel = /^\d{6,20}$/.test(pixelId) ? pixelId : "";

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const url = (page, lang) => {
  const slug = site.pages[page][lang];
  return slug ? `/${lang}/${slug}/` : `/${lang}/`;
};
const fmt = (cents, lang) =>
  lang === "fr" ? `${(cents / 100).toFixed(cents % 100 ? 2 : 0).replace(".", ",")} $` : `CA$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

const heart = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#c73d31" d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.1c2.2-.2 3.9 1 6 3.2 2.1-2.2 3.8-3.4 6-3.2 3.7.4 5.6 4.3 4 7.6C19.5 16.4 12 21 12 21z"/></svg>`;
const shield = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>`;

function publicOffers() {
  const o = {};
  for (const [k, v] of Object.entries(offersConfig.offers))
    o[k] = { amount: v.amount, enabled: v.enabled, role: v.role, product: v.product, showIfMissing: v.showIfMissing };
  return o;
}

function clientConfig(lang, page) {
  const t = copy[lang];
  const urls = {};
  for (const p of Object.keys(site.pages)) urls[p] = url(p, lang);
  return {
    lang, page, pk, pixel: !!pixel,
    currency: offersConfig.currency,
    offers: publicOffers(),
    flow: offersConfig.flow,
    urls,
    names: t.names,
    t: { common: t.common, checkout: t.checkout, upsell: t.upsell, apply: t.apply.form },
  };
}

function layout({ lang, page, title, description, body, scripts = [], stripe = false, noindex = true }) {
  const t = copy[lang];
  const other = lang === "fr" ? "en" : "fr";
  const logo = site.logo[lang]
    ? `<img src="${esc(site.logo[lang])}" alt="${esc(t.nav.logoAlt)}">`
    : `${heart}<span>${esc(t.meta.siteName)}</span>`;
  const cfg = JSON.stringify(clientConfig(lang, page)).replace(/</g, "\\u003c");
  const pixelHead = pixel
    ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');</script>`
    : "";
  return `<!doctype html>
<html lang="${esc(t.meta.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : ""}
<link rel="alternate" hreflang="fr-CA" href="https://${site.domain}${url(page, "fr")}">
<link rel="alternate" hreflang="en-CA" href="https://${site.domain}${url(page, "en")}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta name="theme-color" content="#795A94">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@600;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css">
<script>(function(){var d=document.documentElement;try{var q=new URLSearchParams(location.search).get("v");var m=document.cookie.match(/(?:^|; )md_v=(a|b)/);var v=q==="a"||q==="b"?q:m?m[1]:Math.random()<0.5?"a":"b";document.cookie="md_v="+v+";path=/;max-age=7776000;samesite=lax";d.setAttribute("data-v",v)}catch(e){d.setAttribute("data-v","a")}})();</script>
<script>window.MD=${cfg};</script>
${pixelHead}
</head>
<body>
${pixel ? `<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${pixel}&ev=PageView&noscript=1"></noscript>` : ""}
<header class="topbar"><div class="wrap">
  <a class="logo" href="${url("home", lang)}">${logo}</a>
  <nav class="toggle" aria-label="${esc(t.nav.toggleLabel)}">
    <a href="${url(page, "fr")}" data-lang="fr" hreflang="fr" aria-current="${lang === "fr"}">FR</a>
    <a href="${url(page, "en")}" data-lang="en" hreflang="en" aria-current="${lang === "en"}">EN</a>
  </nav>
</div></header>
<main>
${body}
</main>
<footer><div class="wrap">
  <p>${esc(t.common.footerSupport)} <a href="mailto:${esc(site.supportEmail)}">${esc(site.supportEmail)}</a></p>
  <nav><a href="${url("terms", lang)}">${esc(t.common.terms)}</a><a href="${url("privacy", lang)}">${esc(t.common.privacy)}</a></nav>
  <p>${esc(t.common.footerEarnings)}</p>
  <p>&copy; ${new Date().getFullYear()} ${esc(t.common.rights)}</p>
</div></footer>
${stripe ? '<script src="https://js.stripe.com/v3/"></script>' : ""}
<script type="module" src="/assets/app.js"></script>
${scripts.map((s) => `<script type="module" src="/assets/${s}"></script>`).join("\n")}
</body>
</html>
`;
}

// ---------- pages ----------
function videoBlock(lang) {
  const t = copy[lang].home.video;
  const v = site.video[lang];
  if (!v) return `<div class="video"><div class="video-placeholder"><div class="play"></div><p>${esc(t.placeholder)}</p></div></div>`;
  if (/\.mp4($|\?)/.test(v))
    return `<div class="video"><video data-autoplay muted playsinline loop preload="metadata" src="${esc(v)}"></video><button class="tap-sound" type="button">${esc(t.tapForSound)}</button></div>`;
  return `<div class="video"><iframe src="${esc(v)}" title="Eryn" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
}

function buyButton(label) {
  return `<button class="btn" type="button" data-open-checkout>${esc(label)}</button>`;
}

function checkoutModal(lang) {
  const t = copy[lang].checkout;
  const c = copy[lang].common;
  const o = offersConfig.offers;
  const bump = (key, b) =>
    o[key].enabled
      ? `<div class="bump">
  <label class="bump-head"><span class="arrow" aria-hidden="true">&#10140;</span><input type="checkbox" name="bump" value="${key}"><span class="label">${esc(t.bumpArrow)}</span></label>
  <div class="bump-body"><strong>${esc(b.headline)}</strong>${esc(b.pitch)}</div>
</div>`
      : "";
  return `<div class="modal" id="checkout" role="dialog" aria-modal="true" aria-labelledby="checkout-title" hidden>
  <div class="modal-backdrop" data-close></div>
  <div class="modal-sheet">
    <div class="modal-head"><h2 id="checkout-title">${esc(t.title)}</h2><button class="modal-close" type="button" data-close aria-label="${esc(t.close)}">&times;</button></div>
    <form class="modal-body" id="checkout-form" novalidate>
      ${pk ? "" : `<p class="notice">${esc(t.notConfigured)}</p>`}
      <label for="co-email">${esc(t.email)}</label>
      <input id="co-email" name="email" type="email" autocomplete="email" required>
      <p class="field-help">${esc(t.emailHelp)}</p>
      <p class="field-error" data-error="email">${esc(t.errors.email)}</p>
      <label for="co-name">${esc(t.firstName)}</label>
      <input id="co-name" name="firstName" type="text" autocomplete="given-name" required maxlength="60">
      <p class="field-error" data-error="firstName">${esc(t.errors.firstName)}</p>
      ${bump("props17", t.bump1)}
      ${bump("carriers27", t.bump2)}
      <ul class="lines">
        <li><span>${esc(t.kitLine)}</span><span>${fmt(o.kit27.amount, lang)}</span></li>
        <li data-line="props17" hidden><span>${esc(copy[lang].names.props17)}</span><span>${fmt(o.props17.amount, lang)}</span></li>
        <li data-line="carriers27" hidden><span>${esc(copy[lang].names.carriers27)}</span><span>${fmt(o.carriers27.amount, lang)}</span></li>
        <li class="total"><span>${esc(t.total)}</span><span data-total>${fmt(o.kit27.amount, lang)}</span></li>
      </ul>
      <p class="muted">${esc(t.taxNote)}</p>
      <label>${esc(t.card)}</label>
      <div id="payment-element"></div>
      <p class="field-error" data-error="card"></p>
      <button class="btn" type="submit" id="pay-btn" ${pk ? "" : "disabled"}>${esc(t.pay)} <span data-total>${fmt(o.kit27.amount, lang)}</span></button>
      <p class="btn-note">${esc(t.secure)}</p>
      <div class="guarantee">${shield}<span>${esc(c.guarantee)}</span></div>
    </form>
  </div>
</div>`;
}

function home(lang) {
  const t = copy[lang].home;
  const cover = site.kitCover
    ? `<img src="${esc(site.kitCover)}" alt="${esc(t.buy.coverTitle)}" style="border-radius:12px;margin-bottom:18px">`
    : `<div class="cover">${heart.replace('fill="#c73d31"', 'fill="#ffffff"')}<div><strong>${esc(t.buy.coverTitle)}</strong><span>${esc(t.buy.coverSub)}</span></div></div>`;
  const photo = site.erynPhoto
    ? `<img class="photo" src="${esc(site.erynPhoto)}" alt="${esc(t.eryn.photoAlt)}">`
    : `<div class="photo" role="img" aria-label="${esc(t.eryn.photoAlt)}">E</div>`;
  const testimonials = t.testimonials.items.length
    ? `<section class="section soft"><div class="wrap"><h2 class="center">${esc(t.testimonials.title)}</h2>
${t.testimonials.items.map((q) => `<blockquote class="quote"><p>${esc(q.text)}</p><cite>${esc(q.name)}, ${esc(q.town)}</cite></blockquote>`).join("\n")}
</div></section>`
    : "";
  const body = `
<section class="hero"><div class="wrap">
  <span class="pill">${esc(t.pill)}</span>
  <h1><span class="ha">${esc(t.headlineA)}</span><span class="hb">${esc(t.headlineB)}</span></h1>
  <p class="sub">${esc(t.sub)}</p>
  ${videoBlock(lang)}
  ${buyButton(t.buy.button)}
</div></section>

<section class="section" id="kit"><div class="wrap">
  <div class="buybox">
    ${cover}
    <h2>${esc(t.buy.title)}</h2>
    <ul class="checks">${t.buy.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    <p class="price">${esc(t.buy.price)}</p>
    ${buyButton(t.buy.button)}
    <div class="guarantee">${shield}<span>${esc(copy[lang].common.guarantee)}</span></div>
  </div>
</div></section>

<section class="section soft"><div class="wrap">
  <h2>${esc(t.how.title)}</h2>
  <ol class="steps">${t.how.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol>
</div></section>

<section class="section"><div class="wrap">
  <h2>${esc(t.forYou.title)}</h2>
  <ul class="checks">${t.forYou.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
  ${buyButton(t.buy.button)}
</div></section>

<section class="section soft"><div class="wrap eryn">
  ${photo}
  <div>
    <h2>${esc(t.eryn.title)}</h2>
    <ul>${t.eryn.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
    <p>${esc(t.eryn.story)}</p>
  </div>
</div></section>

${testimonials}

<section class="section"><div class="wrap">
  <div class="stats">${t.stats.map((s) => `<div>${esc(s)}</div>`).join("")}</div>
</div></section>

<section class="section soft"><div class="wrap">
  <h2>${esc(t.faq.title)}</h2>
  ${t.faq.items.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n")}
</div></section>

<section class="section"><div class="wrap center">
  <h2>${esc(t.final.title)}</h2>
  ${buyButton(t.final.button)}
  <div class="guarantee" style="justify-content:center">${shield}<span>${esc(copy[lang].common.guarantee)}</span></div>
</div></section>

${checkoutModal(lang)}`;
  return layout({
    lang, page: "home", title: copy[lang].meta.title, description: copy[lang].meta.description,
    body, scripts: ["checkout.js"], stripe: !!pk, noindex: false,
  });
}

function offerPage(lang, key) {
  const t = copy[lang][key];
  // Progress: checkout, each enabled offer, then the thank-you page.
  const enabled = offersConfig.flow.filter((k) => offersConfig.offers[k].enabled);
  const segments = enabled.length + 2;
  const current = enabled.indexOf(key) + 2;
  const body = `
<section class="section" style="padding-top:8px"><div class="wrap" data-offer="${key}">
  <div class="progress" aria-hidden="true">${Array.from({ length: segments }, (_, i) => `<span class="${i < current ? "on" : ""}"></span>`).join("")}</div>
  <h1>${esc(t.title)}</h1>
  <p class="sub">${esc(t.lead)}</p>
  ${t.body.map((p) => `<p>${esc(p)}</p>`).join("")}
  <div class="offer-card">
    <h3>${esc(t.itemsTitle)}</h3>
    <ul class="checks">${t.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    <p>${esc(t.steps)}</p>
    <p class="price">${esc(t.price)}</p>
    <button class="btn" type="button" data-yes>${esc(t.yes)}</button>
    <p class="btn-note">${esc(t.yesNote)}</p>
    <button class="link-no" type="button" data-no>${esc(t.no)}</button>
    <p class="status" role="status" aria-live="polite"></p>
  </div>
  <div class="guarantee">${shield}<span>${esc(copy[lang].common.guarantee)}</span></div>
</div></section>`;
  return layout({ lang, page: key, title: `${t.title} | ${copy[lang].meta.siteName}`, description: t.lead, body, scripts: ["upsell.js"], stripe: !!pk });
}

function thanks(lang) {
  const t = copy[lang].thanks;
  const kajabi = site.kajabiLoginUrl
    ? `<a class="btn secondary" href="${esc(site.kajabiLoginUrl)}" rel="noopener">${esc(t.kajabiButton)}</a>`
    : "";
  const body = `
<section class="section"><div class="wrap">
  <h1>${esc(t.title)}</h1>
  <p class="sub">${esc(t.lead)}</p>
  <ol class="steps">${t.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol>
  ${kajabi}
  <div class="summary" id="summary"><strong>${esc(t.orderSummary)}</strong><ul></ul></div>
  <p>${esc(t.note)}</p>
</div></section>
<section class="section soft"><div class="wrap">
  <h2>${esc(t.nextTitle)}</h2>
  ${t.next.map((n) => `<div class="next-card"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></div>`).join("")}
  <a class="btn" href="${url("apply", lang)}">${esc(t.applyButton)}</a>
</div></section>`;
  return layout({ lang, page: "thanks", title: `${t.title} | ${copy[lang].meta.siteName}`, description: t.lead, body, scripts: ["thanks.js"] });
}

function applyPage(lang) {
  const t = copy[lang].apply;
  const f = t.form;
  const body = `
<section class="section"><div class="wrap">
  <h1>${esc(t.title)}</h1>
  ${t.intro.map((p) => `<p>${esc(p)}</p>`).join("")}
  <h2 style="margin-top:24px">${esc(t.howTitle)}</h2>
  <ol class="steps">${t.how.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol>
</div></section>
<section class="section soft"><div class="wrap">
  <form id="apply-form" novalidate>
    <label for="ap-name">${esc(f.name)}</label><input id="ap-name" name="name" type="text" autocomplete="name" required maxlength="100">
    <label for="ap-email">${esc(f.email)}</label><input id="ap-email" name="email" type="email" autocomplete="email" required>
    <label for="ap-city">${esc(f.city)}</label><input id="ap-city" name="city" type="text" autocomplete="address-level2" required maxlength="100">
    <label for="ap-teach">${esc(f.teach)}</label><textarea id="ap-teach" name="teach" required maxlength="500"></textarea>
    <label for="ap-program">${esc(f.program)}</label>
    <select id="ap-program" name="program">${Object.entries(f.programOptions).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select>
    <label for="ap-why">${esc(f.why)}</label><textarea id="ap-why" name="why" maxlength="1500"></textarea>
    <label for="ap-dates">${esc(f.dates)}</label><input id="ap-dates" name="dates" type="text" maxlength="300">
    <div class="hp" aria-hidden="true"><label for="ap-website">Website</label><input id="ap-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
    <p class="muted" style="margin-top:14px">${esc(f.privacy)}</p>
    <button class="btn" type="submit" style="margin-top:8px">${esc(f.submit)}</button>
    <p class="status" role="status" aria-live="polite"></p>
  </form>
</div></section>`;
  return layout({ lang, page: "apply", title: `${t.title} | ${copy[lang].meta.siteName}`, description: t.intro[0], body, scripts: ["apply.js"], noindex: false });
}

function legal(lang, key) {
  const t = copy[lang][key];
  const body = `<section class="section legal"><div class="wrap"><h1>${esc(t.title)}</h1>${t.body.map((p) => `<p>${esc(p)}</p>`).join("")}<p><a href="mailto:${esc(site.supportEmail)}">${esc(site.supportEmail)}</a></p></div></section>`;
  return layout({ lang, page: key, title: `${t.title} | ${copy[lang].meta.siteName}`, description: t.title, body });
}

// ---------- write ----------
function write(path, html) {
  const file = new URL(path, out);
  mkdirSync(dirname(file.pathname), { recursive: true });
  writeFileSync(file, html);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const built = [];
for (const lang of LANGS) {
  const pages = {
    home: home(lang),
    thanks: thanks(lang),
    apply: applyPage(lang),
    terms: legal(lang, "terms"),
    privacy: legal(lang, "privacy"),
  };
  for (const key of offersConfig.flow) pages[key] = offerPage(lang, key);
  for (const [page, html] of Object.entries(pages)) {
    const path = url(page, lang).slice(1) + "index.html";
    write(path, html);
    built.push("/" + path.replace(/index\.html$/, ""));
  }
}
// "/" serves French. On a first visit, an English browser goes to /en/.
const rootRedirect = `<script>(function(){try{var c=document.cookie.match(/(?:^|; )md_lang=(fr|en)/);var l=c?c[1]:((navigator.language||"").toLowerCase().indexOf("en")===0?"en":"fr");if(l==="en")location.replace("/en/"+location.search+location.hash)}catch(e){}})();</script>`;
write("index.html", home("fr").replace("<head>", "<head>\n" + rootRedirect));

// assets
mkdirSync(new URL("assets/", out), { recursive: true });
const assetsDir = new URL("../src/assets/", import.meta.url);
for (const f of readdirSync(assetsDir)) copyFileSync(new URL(f, assetsDir), new URL("assets/" + f, out));
copyFileSync(new URL("../lib/flow.js", import.meta.url), new URL("assets/flow.js", out));
writeFileSync(
  new URL("assets/favicon.svg", out),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${heart.replace(/<\/?svg[^>]*>/g, "")}</svg>`
);

console.log(`Built ${built.length} pages${pk ? ` (Stripe ${pk.startsWith("pk_live_") ? "LIVE" : "test"} key)` : " (preview, no Stripe key)"}:`);
for (const b of built) console.log("  " + b);
