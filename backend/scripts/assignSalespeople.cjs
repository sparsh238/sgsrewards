#!/usr/bin/env node
/**
 * Populate each IN-SCHEME loyalty dealer with the sales team who handle them,
 * from the BI mirror (matched by GSTIN, last ~12 months of turnover):
 *   salespersons[] — every rep active on the dealer (a dealer can have several)
 *   salesperson    — the primary (most-active) rep, for display
 *   salesHead      — the manager (Manoj / Rajiv), most-frequent
 * This is the association the `sales` role scopes on. In-scheme only; test
 * accounts and redeem-only dealers are skipped. Idempotent: writes only on change.
 *
 *   node scripts/assignSalespeople.cjs --dry-run   # report only, write nothing
 *   node scripts/assignSalespeople.cjs             # apply
 */
const fs = require('fs'), path = require('path'), mongoose = require('mongoose');
const DRY = process.argv.includes('--dry-run');
const readEnv = (p, k) => { try { for (const l of fs.readFileSync(p, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && m[1] === k) return m[2].replace(/^["']|["']$/g, ''); } } catch {} return null; };
const HERE = __dirname;
const LOY = process.env.MONGO_URI || readEnv(path.join(HERE, '..', '.env'), 'MONGO_URI');
const BI_ENV = '/Users/sparsh/Desktop/Global Policies/Data Analysis/06_mongo/.env';
const BI = process.env.BI_MONGO_URI || readEnv(BI_ENV, 'BI_MONGO_URI');
const BIDB = process.env.BI_MONGO_DB || readEnv(BI_ENV, 'BI_MONGO_DB') || 'sanjay_cd_distribution';
if (!LOY || !BI) { console.error('Missing MONGO_URI or BI_MONGO_URI'); process.exit(1); }
const NOISE = new Set(['(n/a)', '-', 'REVIEW', '', 'NA', '(wholesale)']);
const TEST_RX = /\btest\b|new user/i; // dummy accounts to skip
const WINDOW = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08'];
// Manual reassignments that override the BI-derived reps (keyed by loyalty
// partyName). The "Rajiv (Sales Head)" rep-book is dissolved — the head gets no
// rep account, so his dealers move to real reps. salesHead is left as BI has it.
const OVERRIDE = {
  'S R Electronics & Appliances (Jaipur)': ['Ashok'],
  'S.r. Electronics (Jaipur)': ['Ashok'],
  'The Choice Palace (Jaipur)': ['Ashok'],
  'Shree Govindam Distributors (Jaipur)': ['Ashok'],
  'S S Electronics (Jaipur)': ['BP'],
};
const norm = (g) => String(g || '').toUpperCase().trim();
const clean = (s) => { const t = String(s == null ? '' : s).trim(); return NOISE.has(t) || NOISE.has(t.toLowerCase()) ? '' : t; };
const sameArr = (a, b) => { const x = [...(a || [])].sort(), y = [...(b || [])].sort(); return x.length === y.length && x.every((v, i) => v === y[i]); };

(async () => {
  console.log(`Assign salespeople (multi + head) ${DRY ? '(DRY RUN — no writes)' : '(LIVE)'} | in-scheme only`);
  const bi = await mongoose.createConnection(BI, { dbName: BIDB }).asPromise();
  const biDealers = await bi.db.collection('dealers').find({}, { projection: { gstin: 1, dealer: 1, _id: 0 } }).toArray();
  const nameByGst = new Map(); for (const d of biDealers) if (d.gstin) nameByGst.set(norm(d.gstin), d.dealer);
  const T = bi.db.collection('transactions');
  const spAgg = await T.aggregate([{ $match: { period: { $in: WINDOW }, is_turnover: true } }, { $group: { _id: { d: '$dealer', s: '$salesperson' }, n: { $sum: 1 } } }]).toArray();
  const mgrAgg = await T.aggregate([{ $match: { period: { $in: WINDOW }, is_turnover: true } }, { $group: { _id: { d: '$dealer', m: '$manager' }, n: { $sum: 1 } } }]).toArray();
  await bi.close();
  const spByDealer = new Map(), mgrByDealer = new Map();
  for (const a of spAgg) { const s = clean(a._id.s); if (!s) continue; const arr = spByDealer.get(a._id.d) || []; arr.push({ s, n: a.n }); spByDealer.set(a._id.d, arr); }
  for (const a of mgrAgg) { const m = clean(a._id.m); if (!m) continue; const arr = mgrByDealer.get(a._id.d) || []; arr.push({ m, n: a.n }); mgrByDealer.set(a._id.d, arr); }

  const lc = await mongoose.createConnection(LOY).asPromise();
  const U = lc.db.collection('users');
  const dealers = await U.find({ userType: 'customer', inScheme: { $ne: false } }, { projection: { partyName: 1, gstin: 1, salesperson: 1, salespersons: 1, salesHead: 1 } }).toArray();

  let changed = 0, unchanged = 0, skippedTest = 0, unassigned = 0;
  const roster = {}, heads = {};
  for (const u of dealers) {
    if (TEST_RX.test(u.partyName || '')) { skippedTest++; continue; }
    const nm = u.gstin ? nameByGst.get(norm(u.gstin)) : null;
    const sps = (spByDealer.get(nm) || []).slice().sort((a, b) => b.n - a.n || a.s.localeCompare(b.s));
    let primary = sps[0]?.s || '';
    let salespersons = [...new Set(sps.map((x) => x.s))].sort(); // deterministic set for the array
    const head = (mgrByDealer.get(nm) || []).slice().sort((a, b) => b.n - a.n)[0]?.m || '';
    const ov = OVERRIDE[u.partyName];
    if (ov) { salespersons = [...ov].sort(); primary = ov[0]; }

    if (!salespersons.length) { unassigned++; continue; }
    salespersons.forEach((s) => roster[s] = (roster[s] || 0) + 1);
    if (head) heads[head] = (heads[head] || 0) + 1;

    const same = u.salesperson === primary && sameArr(u.salespersons, salespersons) && (u.salesHead || '') === head;
    if (same) { unchanged++; continue; }
    if (!DRY) await U.updateOne({ _id: u._id }, { $set: { salesperson: primary, salespersons, salesHead: head } });
    changed++;
  }

  console.log(`\nin-scheme dealers: ${dealers.length} | ${DRY ? 'would change' : 'changed'}: ${changed} | unchanged: ${unchanged} | skipped test: ${skippedTest} | unassigned: ${unassigned}`);
  console.log('\nsalesperson roster (dealers where they appear):');
  Object.entries(roster).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`   ${s.padEnd(22)} ${n}`));
  console.log('\nsales heads:');
  Object.entries(heads).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`   ${s.padEnd(22)} ${n}`));
  if (DRY) console.log('\nDRY RUN — nothing was written.');
  await lc.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
