import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiJson } from './api';

export interface SpinSeg { label: string; points: number }
export interface SpinStatus {
  enabled: boolean;
  eligible: boolean;      // tier is Basic+
  entryFee: number;
  balance: number;
  canSpin: boolean;       // eligible AND not spun today AND balance >= entryFee
  reason: 'ineligible' | 'spun-today' | 'low-balance' | null;
  segments: SpinSeg[];    // labels + points only — no odds
  lastResult: number | null;
  nextResetAt: string;
}

interface SpinCtx { status: SpinStatus | null; loading: boolean; refresh: () => void }
const Ctx = createContext<SpinCtx>({ status: null, loading: true, refresh: () => {} });

// Shared once per dealer session, consumed by the teaser, the Home card and the
// Spin screen so they all agree on “ready / already spun”.
export function SpinProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SpinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => {
    apiJson<SpinStatus>('/api/spin/status')
      .then((s) => setStatus(s))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return <Ctx.Provider value={{ status, loading, refresh }}>{children}</Ctx.Provider>;
}

export const useSpin = (): SpinCtx => useContext(Ctx);
