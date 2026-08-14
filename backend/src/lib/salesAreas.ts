// Named sales AREAS → the scope they grant. A sales user is assigned one or more
// areas; their salesRegions/salesBooks are the union of the areas' scope. Zone
// areas (Alwar 1/2, Jaipur 1/2) map to a rep BOOK set (shared visibility); the
// rest map to a whole canonical REGION. Single source of truth for the create
// form and the seed. Order here is the order shown in the picker.
export const AREAS: Record<string, { books?: string[]; regions?: string[] }> = {
  'Alwar 1': { books: ['Karan', 'Manish'] },
  'Alwar 2': { books: ['Yash', 'Shubham'] },
  'Jaipur 1': { books: ['BP'] },
  'Jaipur 2': { books: ['Ashok'] },
  'Delhi Road': { regions: ['Delhi Road'] },
  'Jaipur': { regions: ['Jaipur'] },
  'Bharatpur': { regions: ['Bharatpur'] },
  'Dhaulpur': { regions: ['Dhaulpur'] },
  'Sawai Madhopur': { regions: ['Sawai Madhopur'] },
  'Tonk': { regions: ['Tonk'] },
  'Dausa': { regions: ['Dausa'] },
  'Karauli': { regions: ['Karauli'] },
  'Ajmer': { regions: ['Ajmer'] },
  'Churu': { regions: ['Churu'] },
  'Sikar': { regions: ['Sikar'] },
  'Jhunjhunu': { regions: ['Jhunjhunu'] },
  'Nagaur': { regions: ['Nagaur'] },
};

export const AREA_NAMES = Object.keys(AREAS);

// Union the scope of the given areas into { salesRegions, salesBooks }. Unknown
// area names are ignored (fail safe).
export function areasToScope(areas: string[]): { salesRegions: string[]; salesBooks: string[] } {
  const regions = new Set<string>(), books = new Set<string>();
  for (const a of areas || []) {
    const def = AREAS[a];
    if (!def) continue;
    (def.regions || []).forEach((r) => regions.add(r));
    (def.books || []).forEach((b) => books.add(b));
  }
  return { salesRegions: [...regions], salesBooks: [...books] };
}
