// Indian fiscal year: Apr–Mar. Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar.
// Tier evaluation and the overview target bars use the CURRENT fiscal quarter's
// window only — not a rolling N-month window — so pre-quarter billing never leaks in.
export interface FQ {
  key: string;      // e.g. "2026-Q2" (stable per quarter, for the once-per-quarter lock)
  q: number;        // 1..4
  fyLabel: string;  // "FY2026-27"
  label: string;    // "Q2 · FY2026-27"
  from: Date;       // quarter start (inclusive)
  to: Date;         // quarter end (exclusive)
  periodFrom: string; // "YYYY-MM" of the first month (inclusive)
  periodTo: string;   // "YYYY-MM" of the month AFTER the quarter (exclusive)
}

export function fiscalQuarter(now: Date): FQ {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-11
  let q: number, fyStart: number;
  if (m >= 3 && m <= 5) { q = 1; fyStart = y; }
  else if (m >= 6 && m <= 8) { q = 2; fyStart = y; }
  else if (m >= 9 && m <= 11) { q = 3; fyStart = y; }
  else { q = 4; fyStart = y - 1; } // Jan–Mar belongs to the FY that started the prior April
  const startMonth = q === 1 ? 3 : q === 2 ? 6 : q === 3 ? 9 : 0;
  const startYear = q === 4 ? fyStart + 1 : fyStart;
  const from = new Date(Date.UTC(startYear, startMonth, 1));
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 3);
  const fyLabel = `FY${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
  return {
    key: `${fyStart}-Q${q}`, q, fyLabel, label: `Q${q} · ${fyLabel}`, from, to,
    periodFrom: from.toISOString().slice(0, 7), periodTo: to.toISOString().slice(0, 7),
  };
}
