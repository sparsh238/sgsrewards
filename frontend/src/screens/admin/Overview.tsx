import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatNumber } from '../../lib/format';
import { TIER_ACCENT, type Tier } from '../../lib/tier';

type Status = 'promoting' | 'holds' | 'atRisk' | 'dormant';
interface DealerRow {
  partyName: string; tier: Tier; billed: number;
  floor: number; nextTier: Tier | null; nextReq: number | null;
  status: Status; progress: number;
}
interface Region { region: string; count: number; activeCount: number; dormantCount: number; billed: number; dealers: DealerRow[] }
interface Overview { totals: { dealers: number; promoting: number; atRisk: number; dormant: number }; regions: Region[] }

const fmtMoney = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)}Cr` : `₹${(n / 1e5).toFixed(1)}L`);

// New-territory regions (July-2025 expansion) get a tag.
const NEW_REGIONS = /^(jaipur|sawai\s*madhopur|tonk)$/i;

export default function OverviewScreen() {
  const { auth } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showDorm, setShowDorm] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    apiJson<Overview>('/api/admin/overview').then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, []);

  const q = query.trim().toLowerCase();
  const regions = useMemo(() => {
    if (!data) return [];
    if (!q) return data.regions;
    return data.regions
      .map((r) => ({ ...r, dealers: r.dealers.filter((d) => d.partyName.toLowerCase().includes(q)) }))
      .filter((r) => r.dealers.length > 0);
  }, [data, q]);

  // While searching, auto-expand every region that still has matches.
  const isOpen = (region: string) => (q ? true : !!open[region]);
  const toggle = (region: string) => setOpen((o) => ({ ...o, [region]: !o[region] }));

  const verdict = (s: Status) =>
    s === 'promoting' ? <span className="risk up">▲ promoting</span>
      : s === 'atRisk' ? <span className="risk down">▼ at risk</span>
        : s === 'dormant' ? <span className="risk dorm">◦ dormant</span>
          : <span className="risk hold">— holds</span>;

  const fillColor = (s: Status) =>
    s === 'promoting' ? 'linear-gradient(90deg,#c98a4a,#F0D083)'
      : s === 'atRisk' ? 'linear-gradient(90deg,#5a2a2a,#E07A7A)'
        : 'linear-gradient(90deg,#3a4152,#8fa0b8)';

  const DealerLine = ({ d }: { d: DealerRow }) => (
    <div className={`ov-drow${d.status === 'dormant' ? ' ov-dorm' : ''}`}>
      <div className="ov-dn"><div className="ov-dnn">{d.partyName}</div><div className="ov-dns" style={{ color: TIER_ACCENT[d.tier] }}>{d.tier}</div></div>
      <div className="ov-prog">
        <div className="ov-track"><div className="ov-fill" style={{ width: `${d.progress}%`, background: fillColor(d.status) }} /></div>
        <div className="ov-pl">
          <span>{fmtMoney(d.billed)}{d.nextTier ? ` / ${fmtMoney(d.nextReq ?? 0)} for ${d.nextTier}` : ' · top tier'}</span>
          <span>{d.nextTier ? `${d.progress}%` : ''}</span>
        </div>
      </div>
      {verdict(d.status)}
    </div>
  );

  return (
    <>
      <div className="admin-head">
        <div><h1>Overview</h1><p className="page-sub">Welcome back, {auth.partyName ?? auth.username}.</p></div>
        <div className="admin-toolbar">
          <input className="input" placeholder="Search dealer — expands their region…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {!data && !error && <div className="skeleton" style={{ height: 200 }} />}

      {data && (
        <>
          <div className="kpi-row">
            <div className="kpi"><div className="k-lab">Dealers</div><div className="k-val num">{formatNumber(data.totals.dealers)}</div></div>
            <div className="kpi"><div className="k-lab">On track to promote</div><div className="k-val num" style={{ color: '#5BD6A0' }}>{data.totals.promoting}</div></div>
            <div className="kpi"><div className="k-lab">At risk of drop</div><div className="k-val num" style={{ color: '#E07A7A' }}>{data.totals.atRisk}</div></div>
            <div className="kpi"><div className="k-lab">Dormant (no billing)</div><div className="k-val num" style={{ color: '#8a94a6' }}>{data.totals.dormant}</div></div>
          </div>

          {regions.length === 0 && <div className="empty"><b>No dealers match</b><span>Try a different name.</span></div>}

          {regions.map((r) => {
            const promoting = r.dealers.filter((d) => d.status === 'promoting').length;
            const atRisk = r.dealers.filter((d) => d.status === 'atRisk').length;
            const active = r.dealers.filter((d) => d.status !== 'dormant');
            const dorm = r.dealers.filter((d) => d.status === 'dormant');
            const dormOpen = q ? true : !!showDorm[r.region];
            return (
              <div className="ov-region" key={r.region}>
                <button className={`ov-rh${isOpen(r.region) ? ' open' : ''}`} onClick={() => toggle(r.region)}>
                  <span className="ov-chev">{isOpen(r.region) ? '▾' : '▸'}</span>
                  <span className="ov-rn">{r.region}{NEW_REGIONS.test(r.region) && <span className="ov-newtag">NEW territory</span>}</span>
                  <span className="ov-rmeta">
                    <span>{r.count} dealers</span>
                    {promoting > 0 && <span className="pill-up">▲ {promoting}</span>}
                    {atRisk > 0 && <span className="pill-down">▼ {atRisk}</span>}
                    {dorm.length > 0 && <span className="pill-dorm">◦ {dorm.length}</span>}
                    <span>{fmtMoney(r.billed)}</span>
                  </span>
                </button>
                {isOpen(r.region) && (
                  <div className="ov-rbody">
                    {active.length === 0 && dorm.length > 0 && !dormOpen && (
                      <div className="ov-allquiet">No active dealers this window — all {dorm.length} dormant.</div>
                    )}
                    {active.map((d) => <DealerLine d={d} key={d.partyName} />)}
                    {dorm.length > 0 && (
                      <>
                        {!q && (
                          <button className="ov-dormtoggle" onClick={() => setShowDorm((s) => ({ ...s, [r.region]: !s[r.region] }))}>
                            {dormOpen ? '▾ Hide' : '▸ Show'} {dorm.length} dormant (no billing this window)
                          </button>
                        )}
                        {dormOpen && dorm.map((d) => <DealerLine d={d} key={d.partyName} />)}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
