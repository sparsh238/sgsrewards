#!/usr/bin/env node
/**
 * Busy -> loyalty bill sync. Runs as a step in the daily pipeline AFTER
 * 06_mongo/load_mongo.py has mirrored Busy into the BI Mongo. Reads CD turnover
 * (electronics categories) from the BI mirror, matches in-scheme loyalty dealers
 * by GSTIN, and upserts ONE `source:'busy'` bill per dealer per month of the
 * CURRENT fiscal quarter — crediting points on top of existing balances (MERGE:
 * legacy points are never touched). Idempotent: re-runs adjust by the delta only,
 * and a month that drops to <=0 has its busy bill reversed + removed.
 *
 *   node scripts/syncBusyBills.cjs --dry-run     # compute + report, write NOTHING
 *   node scripts/syncBusyBills.cjs               # apply
 *   node scripts/syncBusyBills.cjs --from 2026-07 --to 2026-09
 *
 * Never touches 'manual' bills. Secrets come from env / .env files, never printed.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DRY = process.argv.includes('--dry-run');
const argVal = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

const readEnv = (p, k) => {
  try { for (const l of fs.readFileSync(p, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && m[1] === k) return m[2].replace(/^["']|["']$/g, ''); } } catch { /* ignore */ }
  return null;
};
const HERE = __dirname;
const LOY = process.env.MONGO_URI || readEnv(path.join(HERE, '..', '.env'), 'MONGO_URI');
const BI_ENV = '/Users/sparsh/Desktop/Global Policies/Data Analysis/06_mongo/.env';
const BI = process.env.BI_MONGO_URI || readEnv(BI_ENV, 'BI_MONGO_URI');
const BIDB = process.env.BI_MONGO_DB || readEnv(BI_ENV, 'BI_MONGO_DB') || 'sanjay_cd_distribution';
if (!LOY || !BI) { console.error('Missing MONGO_URI or BI_MONGO_URI'); process.exit(1); }

const ELEC = ['HA', 'AC', 'AV', 'Deep Freezer', 'Mattress', 'Cooler', 'Chimney', 'Geyser', 'IT', 'Accessory'];
const GST_RX = /^\d{2}[A-Z0-9]{13}$/;

// Current fiscal quarter as an inclusive list of YYYY-MM. The Indian FY (Apr–Mar)
// is shifted by exactly one quarter, so its month groupings match the calendar
// quarters — the quarter-start month is simply floor(month/3)*3.
function currentQuarterPeriods(now = new Date()) {
  const y = now.getUTCFullYear();
  const s = Math.floor(now.getUTCMonth() / 3) * 3; // 0-indexed quarter start month
  return [0, 1, 2].map((i) => `${y}-${String(s + i + 1).padStart(2, '0')}`);
}

const pointsForBill = (amount, tier, conv) => {
  if (!tier || tier === 'NoTier' || amount <= 0) return 0;
  const rate = conv && conv[tier];
  if (!rate || rate <= 0) return 0;
  return Math.ceil(amount / rate);
};
const monthLabel = (p) => { const [y, m] = p.split('-').map(Number); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]}-${y}`; };

(async () => {
  const from = argVal('--from');
  const to = argVal('--to');
  let periods = currentQuarterPeriods();
  if (from && to) { periods = periods.filter(() => false); const [fy, fm] = from.split('-').map(Number); const [ty, tm] = to.split('-').map(Number); for (let y = fy, mo = fm; y < ty || (y === ty && mo <= tm); mo++) { if (mo > 12) { mo = 1; y++; } periods.push(`${y}-${String(mo).padStart(2, '0')}`); } }
  const pMin = periods[0], pMax = periods[periods.length - 1];
  console.log(`Busy->loyalty sync ${DRY ? '(DRY RUN — no writes)' : '(LIVE)'} | quarter ${pMin}..${pMax}`);

  const bi = await mongoose.createConnection(BI, { dbName: BIDB }).asPromise();
  const T = bi.db.collection('transactions'), D = bi.db.collection('dealers');
  const dealers = await D.find({}, { projection: { dealer: 1, gstin: 1, _id: 0 } }).toArray();
  const dealerGst = new Map(dealers.filter((d) => d.gstin).map((d) => [d.dealer, String(d.gstin).toUpperCase().trim()]));
  const agg = await T.aggregate([
    { $match: { period: { $in: periods }, category: { $in: ELEC } } },
    { $group: { _id: { dealer: '$dealer', period: '$period' }, cd: { $sum: '$signed_value' } } },
  ]).toArray();
  const byGstPeriod = new Map(); // `${gst}|${period}` -> amount
  for (const a of agg) { const g = dealerGst.get(a._id.dealer); if (!g) continue; const k = `${g}|${a._id.period}`; byGstPeriod.set(k, (byGstPeriod.get(k) || 0) + a.cd); }
  await bi.close();

  const lc = await mongoose.createConnection(LOY).asPromise();
  const U = lc.db.collection('users'), B = lc.db.collection('bills'), Sys = lc.db.collection('systems');
  const conv = ((await Sys.findOne()) || {}).tierPointsConversion || {};
  const users = await U.find({ userType: 'customer', inScheme: { $ne: false }, gstin: { $regex: GST_RX } }).toArray();

  let created = 0, updated = 0, unchanged = 0, removed = 0, ptsDelta = 0, dealersAffected = 0;
  const sample = [];
  for (const u of users) {
    const g = String(u.gstin).toUpperCase().trim();
    let userPts = 0, touched = false;
    // existing busy bills for this user in-window, keyed by period
    const existing = new Map((await B.find({ userId: u._id, source: 'busy', period: { $in: periods } }).toArray()).map((b) => [b.period, b]));
    for (const period of periods) {
      const amount = Math.round(byGstPeriod.get(`${g}|${period}`) || 0);
      const ex = existing.get(period);
      if (amount > 0) {
        const pts = pointsForBill(amount, u.tier, conv);
        if (!ex) {
          if (!DRY) {
            await B.insertOne({ userId: u._id, billNumber: `Busy ${monthLabel(period)}`, billDate: new Date(`${period}-01T00:00:00Z`), billAmount: amount, pointsAwarded: pts, tierAtBill: u.tier, period, source: 'busy' });
            if (pts > 0) await U.updateOne({ _id: u._id }, [{ $set: { availablePoints: { $max: [0, { $add: ['$availablePoints', pts] }] }, totalPoints: { $max: [0, { $add: ['$totalPoints', pts] }] } } }]);
          }
          created++; ptsDelta += pts; userPts += pts; touched = true;
        } else if (ex.billAmount !== amount) {
          const delta = pts - (typeof ex.pointsAwarded === 'number' ? ex.pointsAwarded : 0);
          if (!DRY) {
            await B.updateOne({ _id: ex._id }, { $set: { billAmount: amount, pointsAwarded: pts, tierAtBill: u.tier } });
            if (delta !== 0) await U.updateOne({ _id: u._id }, [{ $set: { availablePoints: { $max: [0, { $add: ['$availablePoints', delta] }] }, totalPoints: { $max: [0, { $add: ['$totalPoints', delta] }] } } }]);
          }
          updated++; ptsDelta += delta; userPts += delta; touched = true;
        } else { unchanged++; }
      } else if (ex) {
        // month dropped to <=0: reverse the busy bill's points and remove it
        const back = typeof ex.pointsAwarded === 'number' ? ex.pointsAwarded : 0;
        if (!DRY) {
          if (back > 0) await U.updateOne({ _id: u._id }, [{ $set: { availablePoints: { $max: [0, { $subtract: ['$availablePoints', back] }] }, totalPoints: { $max: [0, { $subtract: ['$totalPoints', back] }] } } }]);
          await B.deleteOne({ _id: ex._id });
        }
        removed++; ptsDelta -= back; userPts -= back; touched = true;
      }
    }
    if (touched) { dealersAffected++; if (userPts !== 0) sample.push({ name: u.partyName, tier: u.tier, pts: userPts }); }
  }

  sample.sort((a, b) => b.pts - a.pts);
  console.log(`\nin-scheme dealers scanned: ${users.length} | affected: ${dealersAffected}`);
  console.log(`bills  created ${created} | updated ${updated} | unchanged ${unchanged} | removed ${removed}`);
  console.log(`points ${ptsDelta >= 0 ? '+' : ''}${ptsDelta.toLocaleString('en-IN')} (net, added on top of existing balances)`);
  console.log(`\ntop 15 dealers by points ${DRY ? 'that would be added' : 'added'}:`);
  sample.slice(0, 15).forEach((r) => console.log(`   ${r.name.slice(0, 34).padEnd(35)} ${String(r.tier).padEnd(9)} ${r.pts >= 0 ? '+' : ''}${r.pts} pts`));
  if (DRY) console.log('\nDRY RUN — nothing was written.');
  await lc.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
