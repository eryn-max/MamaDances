// Montreal application form.
import { MD, post, showStatus } from "./common.js";

const form = document.getElementById("apply-form");
const status = form.querySelector(".status");
const btn = form.querySelector('button[type="submit"]');
const T = MD.t.apply;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  btn.disabled = true;
  btn.textContent = T.sending;
  try {
    const data = Object.fromEntries(new FormData(form));
    await post("/api/apply", { ...data, lang: MD.lang });
    form.querySelectorAll("input, textarea, select, button").forEach((el) => (el.disabled = true));
    btn.hidden = true;
    showStatus(status, T.sent);
  } catch {
    btn.disabled = false;
    btn.textContent = T.submit;
    showStatus(status, MD.t.common.errorGeneric, true);
  }
});
