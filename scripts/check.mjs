// Copy and launch checks.
//   npm run check          -> errors fail, [CONFIRM] items and missing assets are warnings
//   npm run check:strict   -> warnings fail too (run before any deploy)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import site from "../config/site.js";
import offersConfig from "../config/offers.js";

const root = new URL("..", import.meta.url);

export function loadCopy() {
  return {
    fr: JSON.parse(readFileSync(new URL("copy/fr.json", root), "utf8")),
    en: JSON.parse(readFileSync(new URL("copy/en.json", root), "utf8")),
  };
}

export function flatten(obj, prefix = "", out = {}) {
  if (Array.isArray(obj)) {
    if (obj.length === 0) out[prefix + "[]"] = "";
    obj.forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = String(obj);
  }
  return out;
}

// Copy rule 6 (hype words), FR and EN. Matched on word starts.
const BANNED = [
  /\bsecrets?\b/i, /\bhacks?\b/i, /\bexplod/i, /\bexplos/i, /\bcrush/i, /\binsane\b/i,
  /guaranteed income/i, /passive income/i, /revenus? passifs?/i, /revenus? garantis?/i,
  /six figures/i, /six chiffres/i, /\bcountdown\b/i, /only \d+ left/i, /plus que \d+ places?/i,
];
// Copy rule 10: no em or en dashes.
const DASHES = /[–—]/;

export function checkCopy(copy) {
  const errors = [];
  const fr = flatten(copy.fr);
  const en = flatten(copy.en);
  for (const k of Object.keys(fr)) if (!(k in en)) errors.push(`Key missing in en.json: ${k}`);
  for (const k of Object.keys(en)) if (!(k in fr)) errors.push(`Key missing in fr.json: ${k}`);
  for (const [lang, flat] of [["fr", fr], ["en", en]]) {
    for (const [k, v] of Object.entries(flat)) {
      if (k.startsWith("_confirm")) continue;
      if (DASHES.test(v)) errors.push(`${lang}.${k}: em or en dash found. Use a period or a comma.`);
      for (const re of BANNED) if (re.test(v)) errors.push(`${lang}.${k}: banned word (${re}).`);
      if (v.trim() === "" && !k.endsWith("[]")) errors.push(`${lang}.${k}: empty text.`);
    }
  }
  return errors;
}

// Rough Flesch-Kincaid grade for English text. Target 4 to 5 (copy rule 1).
function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}
export function fkGrade(text) {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (!sentences.length || !words.length) return 0;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}

export function readability(copyEn) {
  const sections = ["home", "carriers27_upsell", "season97", "props17_downsell", "thanks", "apply"];
  return sections.map((s) => {
    const text = Object.entries(flatten(copyEn[s]))
      .filter(([k]) => !k.endsWith("[]"))
      .map(([, v]) => (/[.!?]$/.test(v.trim()) ? v : v + "."))
      .join(" ");
    return { section: s, grade: Math.round(fkGrade(text) * 10) / 10 };
  });
}

export function launchWarnings(copy) {
  const w = [];
  for (const item of copy.fr._confirm || []) w.push(`[CONFIRM] ${item}`);
  if (!site.video.fr || !site.video.en) w.push("Missing: page 1 video (config/site.js video).");
  if (!site.logo.fr || !site.logo.en) w.push("Missing: logo files (config/site.js logo). A text logo is used for now.");
  if (!site.erynPhoto) w.push("Missing: photo of Eryn (config/site.js erynPhoto).");
  if (!site.kitCover) w.push("Missing: kit cover image (config/site.js kitCover). A drawn cover is used for now.");
  if (!site.kajabiLoginUrl) w.push("Missing: Kajabi login URL for the thank-you button (config/site.js kajabiLoginUrl).");
  if ((copy.fr.home.testimonials.items || []).length < 3)
    w.push("Testimonials hidden: fewer than 3 with confirmed permission.");
  for (const [k, o] of Object.entries(offersConfig.offers))
    if (o.note && o.note.includes("[CONFIRM]")) w.push(`Offer ${k}: ${o.note}`);
  return w;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const strict = process.argv.includes("--strict");
  const copy = loadCopy();
  const errors = checkCopy(copy);
  const warnings = launchWarnings(copy);
  console.log("Readability (English, Flesch-Kincaid grade, target 4 to 5):");
  for (const r of readability(copy.en)) console.log(`  ${r.section.padEnd(18)} ${r.grade}`);
  if (warnings.length) {
    console.log(`\n${warnings.length} item(s) to finish before launch:`);
    for (const x of warnings) console.log("  - " + x);
  }
  if (errors.length) {
    console.error(`\n${errors.length} copy error(s):`);
    for (const e of errors) console.error("  x " + e);
  }
  const fail = errors.length > 0 || (strict && warnings.length > 0);
  console.log(fail ? "\nCHECK FAILED" : "\nCheck passed" + (warnings.length ? " (with launch items above)" : ""));
  process.exit(fail ? 1 : 0);
}
