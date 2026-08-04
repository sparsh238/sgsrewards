/** 12345 -> "12,345" (Indian grouping) */
export const formatNumber = (n: number): string =>
  n.toLocaleString('en-IN');

/** 320000 -> "₹3.2L", 80000 -> "₹80,000" — compact rupee display for billing. */
export const formatRupees = (n: number): string => {
  if (Math.abs(n) >= 100000) {
    const lakhs = n / 100000;
    const rounded = Math.round(lakhs * 10) / 10;
    return `₹${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}L`;
  }
  return `₹${formatNumber(Math.round(n))}`;
};

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
