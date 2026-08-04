import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiJson } from './api';
import { itemPrice, type CartEntry } from './types';

// Shared cart state for the dealer session — drives the on-card quantity
// steppers, the nav badge count, and the Cart screen from one source of truth.
interface CartContextValue {
  entries: CartEntry[];
  loaded: boolean;
  count: number;        // distinct line-items
  units: number;        // total quantity across items (nav badge)
  totalPts: number;
  pendingId: string | null;
  qtyOf: (itemId: string) => number;
  add: (itemId: string) => Promise<void>;
  addQty: (itemId: string, quantity: number) => Promise<void>;
  setQty: (itemId: string, quantity: number) => Promise<void>; // 0 removes
  remove: (itemId: string) => Promise<void>;
  reload: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const clean = (items: CartEntry[]) => items.filter((e) => e.itemId !== null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const cart = await apiJson<{ items: CartEntry[] }>('/api/user/cart');
      setEntries(clean(cart.items));
    } catch { /* leave last-known state */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // The mutation endpoints (/cart/add, /update, /remove) return an UNPOPULATED
  // cart (itemId as a raw ObjectId), so we ignore their body and re-read the
  // populated cart from /cart, which is the only source with full item objects.
  const mutate = useCallback(async (itemId: string, run: () => Promise<unknown>) => {
    setPendingId(itemId);
    try {
      await run();
    } catch { /* reload below still reflects server truth */ }
    finally {
      await reload();
      setPendingId(null);
    }
  }, [reload]);

  const qtyOf = useCallback(
    (itemId: string) => entries.find((e) => e.itemId?._id === itemId)?.quantity ?? 0,
    [entries],
  );

  const addQty = useCallback((itemId: string, quantity: number) =>
    mutate(itemId, () => apiJson<{ items: CartEntry[] }>('/api/user/cart/add', {
      method: 'POST', json: { itemId, quantity },
    })), [mutate]);

  const add = useCallback((itemId: string) => addQty(itemId, 1), [addQty]);

  const setQty = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      return mutate(itemId, () => apiJson<{ items: CartEntry[] }>(`/api/user/cart/remove/${itemId}`, { method: 'DELETE' }));
    }
    return mutate(itemId, () => apiJson<{ items: CartEntry[] }>('/api/user/cart/update', {
      method: 'POST', json: { itemId, quantity },
    }));
  }, [mutate]);

  const remove = useCallback((itemId: string) =>
    mutate(itemId, () => apiJson<{ items: CartEntry[] }>(`/api/user/cart/remove/${itemId}`, { method: 'DELETE' })),
    [mutate]);

  const value = useMemo<CartContextValue>(() => ({
    entries,
    loaded,
    count: entries.length,
    units: entries.reduce((s, e) => s + e.quantity, 0),
    totalPts: entries.reduce((s, e) => (e.itemId ? s + itemPrice(e.itemId) * e.quantity : s), 0),
    pendingId,
    qtyOf, add, addQty, setQty, remove, reload,
  }), [entries, loaded, pendingId, qtyOf, add, addQty, setQty, remove, reload]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
