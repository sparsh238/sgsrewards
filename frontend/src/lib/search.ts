// Forgiving text search: ignore case AND whitespace. So "SAPNA  TRUNK",
// "sapna trunk" and "sapnatrunk" all match "Sapna Trunk And Electronics",
// and stray/leading/trailing spaces never break a match. Empty needle matches all.
export const normalizeSearch = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

export const matchesSearch = (haystack: string, needle: string): boolean =>
  normalizeSearch(haystack).includes(normalizeSearch(needle));
