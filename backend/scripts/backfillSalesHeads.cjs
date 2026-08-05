#!/usr/bin/env node
/**
 * Backfill the reporting line on sales-REP accounts: set each rep's `salesHead`
 * to their manager's username, from the mapping the owner gave:
 *   Manoj  <- Karan, Shubham, Manish, Hitesh
 *   Rajiv  <- Nand Kishore, Ashok, Buddhi Prakash
 * This is the same `salesHead` field the new Edit-salesperson UI writes, so the
 * value is the HEAD's username (validated: head must exist and be read-only).
 * Yash is intentionally NOT mapped (not in the owner's list) — reported, never
 * written. Heads and non-sales users are never touched. Idempotent: writes only
 * on change.
 *
 *   node scripts/backfillSalesHeads.cjs --dry-run   # report only, write nothing
 *   node scripts/backfillSalesHeads.cjs             # apply
 */
const fs = require('fs'), path = require('path'), mongoose = require('mongoose');
const DRY = process.argv.includes('--dry-run');
const readEnv = (p, k) => { try { for (const l of fs.readFileSync(p, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && m[1] === k) return m[2].replace(/^["']|["']$/g, ''); } } catch {} return null; };
const LOY = process.env.MONGO_URI || readEnv(path.join(__dirname, '..', '.env'), 'MONGO_URI');
if (!LOY) { console.error('Missing MONGO_URI'); process.exit(1); }

// rep username -> head username
const MAP = {
  karan: 'manoj', shubham: 'manoj', manish: 'manoj', hitesh: 'manoj', yash: 'manoj',
  nandkishore: 'rajiv', ashok: 'rajiv', bp: 'rajiv',
};

(async () => {
  await mongoose.connect(LOY);
  const Users = mongoose.connection.collection('users');
  const sales = await Users.find({ userType: 'sales' }).toArray();
  const byUsername = new Map(sales.map((u) => [u.username, u]));

  // Validate the two heads exist and are read-only before touching anything.
  const heads = [...new Set(Object.values(MAP))];
  for (const h of heads) {
    const doc = byUsername.get(h);
    if (!doc) { console.error(`ABORT: head "${h}" not found among sales users`); await mongoose.disconnect(); process.exit(1); }
    if (!doc.salesReadOnly) { console.error(`ABORT: "${h}" is not a Sales Head (salesReadOnly is not true)`); await mongoose.disconnect(); process.exit(1); }
  }

  const plan = { set: [], noop: [], missing: [] };
  for (const [rep, head] of Object.entries(MAP)) {
    const doc = byUsername.get(rep);
    if (!doc) { plan.missing.push(rep); continue; }
    if (doc.salesReadOnly) { console.warn(`skip ${rep}: is itself a head`); continue; }
    if (doc.salesHead === head) plan.noop.push(`${rep} -> ${head}`);
    else plan.set.push({ id: doc._id, rep, from: doc.salesHead || '(none)', to: head });
  }

  // Reps present in the DB but not in the mapping (e.g. Yash) — report, never write.
  const unmapped = sales.filter((u) => !u.salesReadOnly && !(u.username in MAP));

  console.log(`\n=== Backfill sales-head reporting line ${DRY ? '(DRY RUN — no writes)' : '(APPLYING)'} ===`);
  console.log(`sales users: ${sales.length}  |  heads: ${heads.join(', ')}`);
  console.log(`\nWILL SET (${plan.set.length}):`);
  plan.set.forEach((c) => console.log(`  + ${c.rep.padEnd(12)} ${c.from}  ->  ${c.to}`));
  console.log(`\nALREADY CORRECT (${plan.noop.length}): ${plan.noop.join(', ') || '—'}`);
  if (plan.missing.length) console.log(`\nMAPPED BUT NOT FOUND: ${plan.missing.join(', ')}`);
  console.log(`\nUNMAPPED reps (left untouched — confirm separately): ${unmapped.map((u) => u.username).join(', ') || '—'}`);

  if (!DRY && plan.set.length) {
    for (const c of plan.set) await Users.updateOne({ _id: c.id }, { $set: { salesHead: c.to } });
    console.log(`\nAPPLIED ${plan.set.length} update(s).`);
  } else if (!DRY) {
    console.log('\nNothing to write.');
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
