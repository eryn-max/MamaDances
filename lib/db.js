// Postgres (Neon via the Vercel Marketplace). Without DATABASE_URL, nothing is
// stored and the functions return null: Stripe still holds every order, and
// Eryn is still notified.
import { neon } from "@neondatabase/serverless";

let sql = null;
let override;

function client() {
  if (override !== undefined) return override;
  if (!process.env.DATABASE_URL) return null;
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}

export function setDb(fake) {
  override = fake;
}

// Returns true if the order is new, false if it was already saved, null without a database.
export async function saveOrder(o) {
  const q = client();
  if (!q) return null;
  const rows = await q`
    insert into orders (id, parent_id, step, items, amount, currency, email, first_name, lang, variant, utm, status)
    values (${o.id}, ${o.parentId}, ${o.step}, ${o.items}, ${o.amount}, ${o.currency}, ${o.email},
            ${o.firstName}, ${o.lang}, ${o.variant}, ${JSON.stringify(o.utm)}, 'pending_access')
    on conflict (id) do nothing
    returning id`;
  return rows.length > 0;
}

export async function markKajabiPosted(id) {
  const q = client();
  if (!q) return null;
  await q`update orders set kajabi_posted_at = now() where id = ${id}`;
}

export async function markRefunded(paymentIntentId) {
  const q = client();
  if (!q) return null;
  await q`update orders set status = 'refunded', refunded_at = now() where id = ${paymentIntentId}`;
}

export async function saveApplication(a) {
  const q = client();
  if (!q) return null;
  await q`
    insert into applications (lang, name, email, city, teach, program, why, dates)
    values (${a.lang}, ${a.name}, ${a.email}, ${a.city}, ${a.teach}, ${a.program}, ${a.why}, ${a.dates})`;
  return true;
}
