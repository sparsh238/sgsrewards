import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiJson } from './api';
import type { Tier } from './tier';

// One tier fetch for the whole dealer session, shared by the themed frame and
// the bottom nav (trophy coin). Kept null until it resolves so nothing flashes
// the wrong colour.
const TierContext = createContext<Tier | null>(null);

export function DealerTierProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<Tier | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<{ tier: Tier }>('/api/user/profile')
      .then((p) => { if (!cancelled) setTier(p.tier); })
      .catch(() => { /* app still works untinted */ });
    return () => { cancelled = true; };
  }, []);

  return <TierContext.Provider value={tier}>{children}</TierContext.Provider>;
}

/** The dealer's tier, or null while loading / on error. */
export function useDealerTier(): Tier | null {
  return useContext(TierContext);
}
