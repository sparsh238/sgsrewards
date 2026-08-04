import { useEffect, useState } from 'react';
import { apiJson } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { TIER_ORDER, type Tier } from '../../lib/tier';

type TierMap = Partial<Record<Tier, number>>;
const EARN_TIERS = TIER_ORDER.filter((t) => t !== 'NoTier');

export default function System() {
  const [earn, setEarn] = useState<TierMap>({});
  const [billing, setBilling] = useState<TierMap>({});
  const [error, setError] = useState('');
  const [savingRates, setSavingRates] = useState(false);
  const [savingReqs, setSavingReqs] = useState(false);
  const { toast, toastError } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const [conv, reqs] = await Promise.all([
          apiJson<{ tierPointsConversion: TierMap }>('/api/superadmin/system/points-conversion'),
          apiJson<{ tierBillingRequirements: TierMap }>('/api/superadmin/system/tier-billing-requirements'),
        ]);
        setEarn(conv.tierPointsConversion ?? {});
        setBilling(reqs.tierBillingRequirements ?? {});
      } catch (err) { setError((err as Error).message); }
    })();
  }, []);

  const saveRates = async () => {
    setSavingRates(true);
    try {
      await apiJson('/api/superadmin/system/points-conversion', {
        method: 'PUT',
        json: { tierPointsConversion: numeric(earn) },
      });
      toast('Earn rates saved');
    } catch (err) { toastError((err as Error).message); }
    finally { setSavingRates(false); }
  };

  const saveReqs = async () => {
    setSavingReqs(true);
    try {
      await apiJson('/api/superadmin/system/tier-billing-requirements', {
        method: 'PUT',
        json: { tierBillingRequirements: numeric(billing) },
      });
      toast('Tier requirements saved');
    } catch (err) { toastError((err as Error).message); }
    finally { setSavingReqs(false); }
  };

  return (
    <>
      <div className="admin-head">
        <div><h1>System settings</h1><p className="page-sub">These values drive points, tiers and the dealer progress bars.</p></div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
        <div>
          <div className="section-label">Earn rates — ₹ of billing per 1 point, by tier</div>
          <p className="hint" style={{ marginTop: 4 }}>Drives both points earned per bill and the “₹ more billing needed” hint, using each dealer’s own tier.</p>
        </div>
        <div className="form-grid">
          {EARN_TIERS.map((t) => (
            <div className="field" key={t}>
              <label htmlFor={`e-${t}`}>{t}</label>
              <input id={`e-${t}`} className="input" type="number" value={earn[t] ?? ''}
                onChange={(e) => setEarn((m) => ({ ...m, [t]: e.target.value === '' ? undefined : Number(e.target.value) }))} />
            </div>
          ))}
        </div>
        <div><button className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={saveRates} disabled={savingRates}>{savingRates ? 'Saving…' : 'Save earn rates'}</button></div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
        <div>
          <div className="section-label">Tier billing requirements — ₹ billed per quarter to hold each tier</div>
          <p className="hint" style={{ marginTop: 4 }}>Drives the “keep / upgrade tier” markers on the dealer progress bar.</p>
        </div>
        <div className="form-grid">
          {EARN_TIERS.map((t) => (
            <div className="field" key={t}>
              <label htmlFor={`b-${t}`}>{t}</label>
              <input id={`b-${t}`} className="input" type="number" value={billing[t] ?? ''}
                onChange={(e) => setBilling((m) => ({ ...m, [t]: e.target.value === '' ? undefined : Number(e.target.value) }))} />
            </div>
          ))}
        </div>
        <div><button className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={saveReqs} disabled={savingReqs}>{savingReqs ? 'Saving…' : 'Save requirements'}</button></div>
      </div>
    </>
  );
}

// Drop empty entries and coerce to numbers before sending.
function numeric(map: TierMap): TierMap {
  const out: TierMap = {};
  for (const t of TIER_ORDER) {
    const v = map[t];
    if (typeof v === 'number' && !Number.isNaN(v)) out[t] = v;
  }
  return out;
}
