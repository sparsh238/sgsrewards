#!/usr/bin/env node
/**
 * Seed the sales-team login accounts (reps + read-only heads). Scope is derived
 * from assigned AREAS (kept in sync with src/lib/salesAreas.ts). Idempotent:
 * re-creates missing accounts and refreshes scope on existing ones, but NEVER
 * resets a password (so a rep who already set theirs keeps it).
 *
 *   node scripts/seedSalesUsers.cjs --dry-run
 *   node scripts/seedSalesUsers.cjs
 */
const fs = require('fs'), path = require('path'), mongoose = require('mongoose'), bcrypt = require('bcryptjs');
const DRY = process.argv.includes('--dry-run');
const readEnv = (p, k) => { try { for (const l of fs.readFileSync(p, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && m[1] === k) return m[2].replace(/^["']|["']$/g, ''); } } catch {} return null; };
const LOY = process.env.MONGO_URI || readEnv(path.join(__dirname, '..', '.env'), 'MONGO_URI');
if (!LOY) { console.error('Missing MONGO_URI'); process.exit(1); }

const AREAS = {
  'Alwar 1': { books: ['Karan', 'Manish'] }, 'Alwar 2': { books: ['Yash', 'Shubham'] },
  'Jaipur 1': { books: ['BP'] }, 'Jaipur 2': { books: ['Ashok'] },
  'Delhi Road': { regions: ['Delhi Road'] }, 'Jaipur': { regions: ['Jaipur'] },
  'Bharatpur': { regions: ['Bharatpur'] }, 'Dhaulpur': { regions: ['Dhaulpur'] },
  'Sawai Madhopur': { regions: ['Sawai Madhopur'] }, 'Tonk': { regions: ['Tonk'] },
  'Dausa': { regions: ['Dausa'] }, 'Karauli': { regions: ['Karauli'] },
};
const scopeOf = (areas) => { const r = new Set(), b = new Set(); for (const a of areas) { const d = AREAS[a] || {}; (d.regions || []).forEach((x) => r.add(x)); (d.books || []).forEach((x) => b.add(x)); } return { salesRegions: [...r], salesBooks: [...b] }; };

// name, username, temp password, areas, head?(read-only)
const USERS = [
  { partyName: 'Karan', username: 'karan', password: 'karan@123', areas: ['Alwar 1', 'Delhi Road'], head: false },
  { partyName: 'Manish', username: 'manish', password: 'manish@123', areas: ['Alwar 1', 'Delhi Road'], head: false },
  { partyName: 'Yash', username: 'yash', password: 'yash@123', areas: ['Alwar 2'], head: false },
  { partyName: 'Shubham', username: 'shubham', password: 'shubham@123', areas: ['Alwar 2'], head: false },
  { partyName: 'Hitesh', username: 'hitesh', password: 'hitesh@123', areas: ['Bharatpur', 'Dhaulpur'], head: false },
  { partyName: 'Manoj', username: 'manoj', password: 'manoj@123', areas: ['Alwar 1', 'Alwar 2', 'Delhi Road', 'Bharatpur', 'Dhaulpur'], head: true },
  { partyName: 'Rajiv', username: 'rajiv', password: 'rajiv@123', areas: ['Jaipur 1', 'Jaipur 2', 'Delhi Road', 'Sawai Madhopur', 'Tonk', 'Dausa', 'Karauli'], head: true },
];

(async () => {
  console.log(`Seed sales users ${DRY ? '(DRY RUN — no writes)' : '(LIVE)'}`);
  const c = await mongoose.createConnection(LOY).asPromise();
  const U = c.db.collection('users');
  let created = 0, updated = 0;
  for (const u of USERS) {
    const { salesRegions, salesBooks } = scopeOf(u.areas);
    const scope = { partyName: u.partyName, userType: 'sales', salesReadOnly: u.head, salesAreas: u.areas, salesRegions, salesBooks };
    const existing = await U.findOne({ username: u.username });
    if (existing) {
      if (!DRY) await U.updateOne({ _id: existing._id }, { $set: scope });
      updated++;
      console.log(`  ~ ${u.username.padEnd(9)} ${u.head ? 'HEAD' : 'rep '}  books[${salesBooks.join(',')}] regions[${salesRegions.join(',')}]`);
    } else {
      if (!DRY) await U.insertOne({ username: u.username, phoneNumber: u.username, password: await bcrypt.hash(u.password, 8), isPasswordReset: false, blocked: false, availablePoints: 0, totalPoints: 0, ...scope });
      created++;
      console.log(`  + ${u.username.padEnd(9)} ${u.head ? 'HEAD' : 'rep '}  books[${salesBooks.join(',')}] regions[${salesRegions.join(',')}]  (temp pw: ${u.password})`);
    }
  }
  console.log(`\n${DRY ? 'would create' : 'created'}: ${created} | ${DRY ? 'would refresh' : 'refreshed'}: ${updated}`);
  if (DRY) console.log('DRY RUN — nothing was written.');
  await c.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
