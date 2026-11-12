// Every page: language memory, ad tracking tags, video sound button.
import { MD, setCookie, session } from "./common.js";

// Remember the language the buyer is reading in (playbook section 8).
setCookie("md_lang", MD.lang, 365);
document.querySelectorAll(".toggle a[data-lang]").forEach((a) => {
  a.addEventListener("click", () => setCookie("md_lang", a.dataset.lang, 365));
  // Keep the ad tags and the headline test when switching language.
  if (location.search) a.href += location.search;
});

// Keep the ad tags (utm_*, fbclid) for the whole visit, so the order knows which ad sold.
const params = new URLSearchParams(location.search);
const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
const found = {};
for (const k of keys) if (params.get(k)) found[k] = params.get(k).slice(0, 200);
if (Object.keys(found).length) session.set("md_utm", found);

// Silent autoplay after 2 seconds, then "Tap for sound" (page spec 7.5).
const video = document.querySelector("video[data-autoplay]");
if (video) {
  setTimeout(() => video.play().catch(() => {}), 2000);
  const btn = document.querySelector(".tap-sound");
  btn?.addEventListener("click", () => {
    video.muted = false;
    video.currentTime = 0;
    video.play().catch(() => {});
    btn.remove();
  });
}
