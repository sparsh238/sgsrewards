import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatNumber } from '../../lib/format';
import { TIER_ACCENT, type Tier } from '../../lib/tier';

type Status = 'promoting' | 'holds' | 'atRisk';
interface DealerRow {
  partyName: string; tier: Tier; billed: number;
  floor: number; nextTier: Tier | null; nextReq: number | null;
  status: Status; progress: number; noBills: boolean;
}
interface Region { region: string; count: number; billedCount: number; atRiskCount: number; promotingCount: number; billed: number; dealers: DealerRow[] }
interface Overview { totals: { dealers: number; billing: number; promoting: number; atRisk: number }; regions: Region[] }

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
  // Verdict filter. 'holds' is the MAINTAIN bucket: cleared the current-tier floor
  // but not yet the next-tier line. null = show everyone.
  const [statusF, setStatusF] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    apiJson<Overview>('/api/admin/overview').then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, []);

  // Global verdict tallies across every region, for the filter chip badges.
  const tally = useMemo(() => {
    const all = (data?.regions ?? []).flatMap((r) => r.dealers);
    return {
      promoting: all.filter((d) => d.status === 'promoting').length,
      holds: all.filter((d) => d.status === 'holds').length,
      atRisk: all.filter((d) => d.status === 'atRisk').length,
    };
  }, [data]);

  const q = query.trim().toLowerCase();
  const regions = useMemo(() => {
    if (!data) return [];
    if (!q && !statusF) return data.regions;
    // Recompute the header counts from the filtered set so the region row's
    // "N dealers ▲x ▼y ₹z" matches the rows actually shown while searching/filtering.
    return data.regions
      .map((r) => {
        const dealers = r.dealers.filter((d) =>
          (!q || d.partyName.toLowerCase().includes(q)) && (!statusF || d.status === statusF));
        return {
          ...r,
          dealers,
          count: dealers.length,
          promotingCount: dealers.filter((d) => d.status === 'promoting').length,
          atRiskCount: dealers.filter((d) => d.status === 'atRisk').length,
          billed: dealers.reduce((s, d) => s + d.billed, 0),
        };
      })
      .filter((r) => r.dealers.length > 0);
  }, [data, q, statusF]);

  // While searching or filtering, auto-expand every region that still has matches.
  const isOpen = (region: string) => (q || statusF ? true : !!open[region]);
  const toggle = (region: string) => setOpen((o) => ({ ...o, [region]: !o[region] }));

  const verdict = (d: DealerRow) =>
    d.status === 'promoting' ? <span className="risk up">▲ promoting</span>
      : d.status === 'atRisk' ? <span className="risk down">{d.noBills ? '▼ at risk · no bills' : '▼ at risk'}</span>
        : <span className="risk hold">— holds</span>;

  const fillColor = (s: Status) =>
    s === 'promoting' ? 'linear-gradient(90deg,#c98a4a,#F0D083)'
      : s === 'atRisk' ? 'linear-gradient(90deg,#5a2a2a,#E07A7A)'
        : 'linear-gradient(90deg,#3a4152,#8fa0b8)';

  const DealerLine = ({ d }: { d: DealerRow }) => {
    // Partition = where the current-tier HOLD line sits on a bar that fills toward
    // the next tier. Only meaningful when there's a next tier and the floor sits
    // below it. Green tick = cleared (safe to hold); grey = still short (drop risk).
    const floorPct = d.nextReq && d.floor > 0 && d.floor < d.nextReq ? (d.floor / d.nextReq) * 100 : null;
    const heldFloor = d.tier !== 'NoTier' && d.billed >= d.floor;
    return (
    <div className={`ov-drow${d.noBills ? ' ov-dorm' : ''}`}>
      <div className="ov-dn"><div className="ov-dnn">{d.partyName}</div><div className="ov-dns" style={{ color: TIER_ACCENT[d.tier] }}>{d.tier}</div></div>
      <div className="ov-prog">
        <div className="ov-track">
          <div className="ov-fill" style={{ width: `${d.progress}%`, background: fillColor(d.status) }} />
          {floorPct != null && (
            <div className={`ov-floor${heldFloor ? ' met' : ''}`} style={{ left: `${floorPct}%` }}
              title={`Keep ${d.tier}: ${fmtMoney(d.floor)}${heldFloor ? ' · cleared' : ' · not yet'}`} />
          )}
        </div>
        <div className="ov-pl">
          <span>{fmtMoney(d.billed)}{d.nextTier ? ` / ${fmtMoney(d.nextReq ?? 0)} for ${d.nextTier}` : ' · top tier'}</span>
          <span>{d.nextTier ? `${d.progress}%` : ''}</span>
        </div>
      </div>
      {verdict(d)}
    </div>
    );
  };

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
            <div className="kpi"><div className="k-lab">In-scheme dealers</div><div className="k-val num">{formatNumber(data.totals.dealers)}</div></div>
            <div className="kpi"><div className="k-lab">Billed this window</div><div className="k-val num" style={{ color: '#5BD6A0' }}>{formatNumber(data.totals.billing)}</div></div>
            <button className={`kpi kpi-btn${statusF === 'promoting' ? ' on' : ''}`} onClick={() => setStatusF((s) => s === 'promoting' ? null : 'promoting')}>
              <div className="k-lab">On track to promote</div><div className="k-val num" style={{ color: '#5BD6A0' }}>{formatNumber(data.totals.promoting)}</div>
            </button>
            <button className={`kpi kpi-btn${statusF === 'atRisk' ? ' on' : ''}`} onClick={() => setStatusF((s) => s === 'atRisk' ? null : 'atRisk')}>
              <div className="k-lab">At risk of drop</div><div className="k-val num" style={{ color: '#E07A7A' }}>{formatNumber(data.totals.atRisk)}</div>
            </button>
          </div>

          <div className="chip-row" style={{ gap: 10 }}>
            <button className={`fchip${statusF === null ? ' on' : ''}`} onClick={() => setStatusF(null)}>All <b className="fc-n">{data.totals.dealers}</b></button>
            <button className={`fchip${statusF === 'promoting' ? ' on' : ''}`} onClick={() => setStatusF('promoting')}>▲ Promote <b className="fc-n">{tally.promoting}</b></button>
            <button className={`fchip${statusF === 'holds' ? ' on' : ''}`} onClick={() => setStatusF('holds')}>— Maintain <b className="fc-n">{tally.holds}</b></button>
            <button className={`fchip${statusF === 'atRisk' ? ' on' : ''}`} onClick={() => setStatusF('atRisk')}>▼ At risk <b className="fc-n">{tally.atRisk}</b></button>
          </div>

          {data.totals.billing === 0 && (
            <div className="ov-note" role="note">
              No bills recorded this quarter yet — the billing feed isn’t connected, so every tiered dealer reads as <b>at risk</b> (₹0 billed). Once bills flow in, promote / hold / at-risk update live.
            </div>
          )}

          {regions.length === 0 && <div className="empty"><b>No dealers match</b><span>Try a different name.</span></div>}

          {regions.map((r) => {
            const billedRows = r.dealers.filter((d) => d.billed > 0);
            const noBills = r.dealers.filter((d) => d.billed <= 0);
            // Of the no-bills dealers, only the tiered ones are actually at risk of
            // dropping — a NoTier in-scheme dealer has nothing to drop from.
            const noBillsAtRisk = noBills.filter((d) => d.status === 'atRisk').length;
            const moreOpen = q || statusF ? true : !!showDorm[r.region];
            return (
              <div className="ov-region" key={r.region}>
                <button className={`ov-rh${isOpen(r.region) ? ' open' : ''}`} onClick={() => toggle(r.region)}>
                  <span className="ov-chev">{isOpen(r.region) ? '▾' : '▸'}</span>
                  <span className="ov-rn">{r.region}{NEW_REGIONS.test(r.region) && <span className="ov-newtag">NEW territory</span>}</span>
                  <span className="ov-rmeta">
                    <span>{r.count} dealers</span>
                    {r.promotingCount > 0 && <span className="pill-up">▲ {r.promotingCount}</span>}
                    {r.atRiskCount > 0 && <span className="pill-down">▼ {r.atRiskCount}</span>}
                    <span>{fmtMoney(r.billed)}</span>
                  </span>
                </button>
                {isOpen(r.region) && (
                  <div className="ov-rbody">
                    {billedRows.length === 0 && noBills.length > 0 && !moreOpen && (
                      <div className="ov-allquiet">No dealer has billed this window — {noBills.length} with no bills{noBillsAtRisk > 0 ? `, ${noBillsAtRisk} at risk of drop` : ''}.</div>
                    )}
                    {billedRows.map((d) => <DealerLine d={d} key={d.partyName} />)}
                    {noBills.length > 0 && (
                      <>
                        {!q && (
                          <button className="ov-dormtoggle" onClick={() => setShowDorm((s) => ({ ...s, [r.region]: !s[r.region] }))}>
                            {moreOpen ? '▾ Hide' : '▸ Show'} {noBills.length} with no bills this window{noBillsAtRisk > 0 ? ` · ${noBillsAtRisk} at risk` : ''}
                          </button>
                        )}
                        {moreOpen && noBills.map((d) => <DealerLine d={d} key={d.partyName} />)}
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
