// Shared by the browser (served as /assets/flow.js) and the server.
// Decides which page comes next in the funnel. Pure functions, no imports.

export function productOf(key, offers) {
  const o = offers[key];
  return (o && o.product) || key;
}

// owned: product keys the buyer already has, e.g. ["kit27", "props17"]
// after: the offer key the buyer just saw, or null right after checkout
// Returns the next offer key, or "thanks".
export function nextStep(owned, after, config) {
  const { flow, offers } = config;
  const start = after == null ? 0 : flow.indexOf(after) + 1;
  for (let i = start; i < flow.length; i++) {
    const key = flow[i];
    const o = offers[key];
    if (!o || !o.enabled) continue;
    if (owned.includes(productOf(key, offers))) continue;
    if (o.showIfMissing && owned.includes(o.showIfMissing)) continue;
    return key;
  }
  return "thanks";
}

export function frontTotal(bumps, config) {
  const { offers } = config;
  let total = offers.kit27.amount;
  for (const b of bumps) total += offers[b].amount;
  return total;
}

export function validBumps(bumps, config) {
  if (!Array.isArray(bumps)) return null;
  const allowed = Object.entries(config.offers)
    .filter(([, o]) => o.role === "bump" && o.enabled)
    .map(([k]) => k);
  const uniq = [...new Set(bumps)];
  return uniq.every((b) => allowed.includes(b)) ? uniq : null;
}
