// Thank-you page: show what was bought, in the buyer's language.
import { MD, session, money } from "./common.js";

const order = session.get("md_order");
const box = document.getElementById("summary");
if (order && Array.isArray(order.lines) && order.lines.length && box) {
  const ul = box.querySelector("ul");
  for (const [key, amount] of order.lines) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = MD.names[key] || key;
    const price = document.createElement("span");
    price.textContent = money(amount);
    li.append(name, price);
    ul.append(li);
  }
  const total = document.createElement("li");
  total.style.fontWeight = "700";
  total.innerHTML = "<span></span><span></span>";
  total.children[0].textContent = MD.t.checkout.total;
  total.children[1].textContent = money(order.total);
  ul.append(total);
  box.classList.add("show");
  // The saved card stays at Stripe; drop the one-click key from this browser.
  delete order.clientSecret;
  session.set("md_order", order);
}
