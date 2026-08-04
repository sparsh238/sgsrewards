/** 12345 -> "12,345" (Indian grouping) */
export const formatNumber = (n: number): string =>
  n.toLocaleString('en-IN');

/** 320000 -> "₹3.2L", 15000000 -> "₹1.5Cr", 80000 -> "₹80,000" — compact rupee display. */
const compact = (n: number, unit: number, suffix: string): string => {
  const v = Math.round((n / unit) * 10) / 10;
  return `₹${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}${suffix}`;
};
export const formatRupees = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 10000000) return compact(n, 10000000, 'Cr'); // ≥ 1 crore
  if (abs >= 100000) return compact(n, 100000, 'L');       // ≥ 1 lakh
  return `₹${formatNumber(Math.round(n))}`;
};

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
