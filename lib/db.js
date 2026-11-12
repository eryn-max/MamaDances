// Postgres on Supabase. Server only: the browser never talks to the database.
// DATABASE_URL = Supabase "Transaction pooler" connection string (port 6543), set in Vercel.
// Without DATABASE_URL, nothing is stored and the functions return null: Stripe
// still holds every order, and Eryn is still notified.
import postgres from "postgres";

let sql = null;
let override;

function client() {
  if (override !== undefined) return override;
  if (!process.env.DATABASE_URL) return null;
  // prepare:false is required by the Supabase transaction pooler. max:1 suits serverless.
  if (!sql) sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require", idle_timeout: 20 });
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
            ${o.firstName}, ${o.lang}, ${o.variant}, ${JSON.stringify(o.utm)}::jsonb, 'pending_access')
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
