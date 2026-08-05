import User from '../models/userModel';

// Scoping for the `sales` role. A sales user sees only the dealers in their
// assigned regions OR tagged to their salesperson "books" (the union). Admin and
// superadmin are never scoped. Read-only sales (managers) may view but not edit.
interface ScopeUser {
  userType?: string;
  salesRegions?: string[];
  salesBooks?: string[];
  salesReadOnly?: boolean;
}
// A dealer's scope-relevant fields — matched against a sales user's region/books.
interface ScopeDealer { region?: string; salesperson?: string; salespersons?: string[] }
const dealerBooks = (d: ScopeDealer): string[] => (d.salespersons?.length ? d.salespersons : d.salesperson ? [d.salesperson] : []);

export const isSales = (u?: ScopeUser): boolean => u?.userType === 'sales';

// Who may perform writes: admin, superadmin, or a full-access (non-read-only) sales user.
export const canEdit = (u?: ScopeUser): boolean =>
  u?.userType === 'admin' || u?.userType === 'superadmin' || (u?.userType === 'sales' && !u.salesReadOnly);

// A Mongo filter (on a customer/User doc) limiting results to a sales user's
// scope. Returns {} for admin/superadmin — no restriction. A sales user whose
// scope is empty matches nothing (fail closed), never everything.
export const salesUserFilter = (u?: ScopeUser): Record<string, unknown> => {
  if (!isSales(u)) return {};
  const or: Record<string, unknown>[] = [];
  if (u!.salesRegions?.length) or.push({ region: { $in: u!.salesRegions } });
  // A dealer matches a book if ANY of its salespeople is in the rep's books.
  if (u!.salesBooks?.length) or.push({ salespersons: { $in: u!.salesBooks } }, { salesperson: { $in: u!.salesBooks } });
  return or.length ? { $or: or } : { _id: null };
};

// Is a single dealer inside a sales user's scope? Used to guard writes and
// single-record reads. Non-sales users are unrestricted (true).
export const dealerInScope = (u: ScopeUser | undefined, dealer: ScopeDealer): boolean => {
  if (!isSales(u)) return true;
  const inRegion = !!u!.salesRegions?.length && !!dealer.region && u!.salesRegions.includes(dealer.region);
  const inBook = !!u!.salesBooks?.length && dealerBooks(dealer).some((s) => u!.salesBooks!.includes(s));
  return inRegion || inBook;
};

// The scoped customer _ids, for endpoints that filter by userId (orders, bills).
// null = no restriction (admin/superadmin).
export const scopedDealerIds = async (u?: ScopeUser): Promise<unknown[] | null> => {
  if (!isSales(u)) return null;
  const docs = await User.find({ userType: 'customer', ...salesUserFilter(u) }, { _id: 1 });
  return docs.map((d) => d._id);
};
