import { Fragment, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatNumber } from '../../lib/format';
import { TIER_ACCENT, TIER_ORDER, tierTargetLines, type Tier } from '../../lib/tier';
import SearchInput from '../../components/SearchInput';
import Chevron from '../../components/Chevron';
import { matchesSearch } from '../../lib/search';
import DealerCard from './DealerCard';

type Status = 'promoting' | 'holds' | 'atRisk';
// 'dormant' (no bills this window) is its own category, orthogonal to the tier
// verdict — it's the priority to chase, so it's never folded into the others.
type Filter = 'all' | Status | 'dormant';
interface DealerRow {
  _id: string;
  partyName: string; tier: Tier; billed: number;
  floor: number; nextTier: Tier | null; nextReq: number | null;
  status: Status; progress: number; noBills: boolean;
}
type FlatDealer = DealerRow & { region: string };
interface Region { region: string; count: number; billedCount: number; atRiskCount: number; promotingCount: number; billed: number; dealers: DealerRow[] }
interface Overview { totals: { dealers: number; billing: number; promoting: number; atRisk: number }; regions: Region[] }

const fmtMoney = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)}Cr` : `₹${(n / 1e5).toFixed(1)}L`);
const rank = (t: Tier) => TIER_ORDER.indexOf(t);
const NEW_REGIONS = /^(jaipur|sawai\s*madhopur|tonk)$/i;
const GROUP_CAP = 8; // rows shown per group before "show more"

// Category predicates — dormant is carved out first, so the verdict buckets only
// ever hold dealers who actually billed this window.
const isDormant = (d: DealerRow) => d.noBills;
const isAtRiskBilled = (d: DealerRow) => d.status === 'atRisk' && !d.noBills;

export default function OverviewScreen() {
  const { auth } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedDealer, setExpandedDealer] = useState<string | null>(null);
  const [focusDealer, setFocusDealer] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiJson<Overview>('/api/admin/overview').then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, []);

  const allDealers: FlatDealer[] = useMemo(
    () => (data?.regions ?? []).flatMap((r) => r.dealers.map((d) => ({ ...d, region: r.region }))),
    [data],
  );

  // Verdict tallies — dormant is counted on its own; the others exclude it.
  const tally = useMemo(() => ({
    promoting: allDealers.filter((d) => d.status === 'promoting' && !d.noBills).length,
    holds: allDealers.filter((d) => d.status === 'holds' && !d.noBills).length,
    atRisk: allDealers.filter(isAtRiskBilled).length,
    dormant: allDealers.filter(isDormant).length,
  }), [allDealers]);

  // "Chase today" — the vital few across every region: dormant tiered dealers
  // (most tier at stake first), then billed-but-at-risk dealers closest to slipping.
  const focus = useMemo(() => {
    const dormTiered = allDealers.filter((d) => d.noBills && d.tier !== 'NoTier')
      .sort((a, b) => rank(b.tier) - rank(a.tier) || b.floor - a.floor);
    const risky = allDealers.filter(isAtRiskBilled)
      .sort((a, b) => rank(b.tier) - rank(a.tier) || (a.floor - a.billed) - (b.floor - b.billed));
    return [...dormTiered, ...risky].slice(0, 6);
  }, [allDealers]);

  const q = query.trim().toLowerCase();
  const matchesFilter = (d: DealerRow) =>
    filter === 'all' ? true
      : filter === 'dormant' ? isDormant(d)
        : filter === 'atRisk' ? isAtRiskBilled(d)
          : d.status === filter && !d.noBills;

  const regions = useMemo(() => {
    if (!data) return [];
    return data.regions
      .map((r) => ({ ...r, dealers: r.dealers.filter((d) => (!q || matchesSearch(d.partyName, query)) && matchesFilter(d)) }))
      .filter((r) => r.dealers.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, filter]);

  const isOpen = (region: string) => (q || filter !== 'all' ? true : !!open[region]);
  const toggle = (region: string) => setOpen((o) => ({ ...o, [region]: !o[region] }));
  const groupOpen = (key: string) => expandedGroups.has(key);
  const toggleGroup = (key: string) => setExpandedGroups((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const verdict = (d: DealerRow) =>
    d.noBills ? <span className="risk dorm">💤 no bills</span>
      : d.status === 'promoting' ? <span className="risk up">▲ promoting</span>
        : d.status === 'atRisk' ? <span className="risk down">▼ at risk</span>
          : <span className="risk hold">— holds</span>;

  const fillColor = (s: Status) =>
    s === 'promoting' ? 'linear-gradient(90deg,#c98a4a,#F0D083)'
      : s === 'atRisk' ? 'linear-gradient(90deg,#5a2a2a,#E07A7A)'
        : 'linear-gradient(90deg,#3a4152,#8fa0b8)';

  const DealerLine = ({ d }: { d: DealerRow }) => {
    const floorPct = d.nextReq && d.floor > 0 && d.floor < d.nextReq ? (d.floor / d.nextReq) * 100 : null;
    const heldFloor = d.tier !== 'NoTier' && d.billed >= d.floor;
    const isOpenRow = expandedDealer === d._id;
    const tog = () => setExpandedDealer(isOpenRow ? null : d._id);
    return (
    <>
    <div className={`ov-drow ov-drow-click${d.noBills ? ' ov-dorm' : ''}${isOpenRow ? ' open' : ''}`} role="button" tabIndex={0}
      onClick={tog} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } }}>
      <div className="ov-dn"><div className="ov-dnn"><Chevron open={isOpenRow} />{d.partyName}</div><div className="ov-dns" style={{ color: TIER_ACCENT[d.tier] }}>{d.tier}</div></div>
      {d.noBills ? (
        <div className="ov-prog ov-dormprog">
          <span className="ov-zero">₹0</span>
          <span className="ov-dormneed">no bills this window{d.tier !== 'NoTier' ? ` · needs ${fmtMoney(d.floor)} to hold ${d.tier}` : ''}</span>
        </div>
      ) : (
        <div className="ov-prog">
          <div className="ov-track">
            <div className="ov-fill" style={{ width: `${d.progress}%`, background: fillColor(d.status) }} />
            {floorPct != null && (
              <div className={`ov-floor${heldFloor ? ' met' : ''}`} style={{ left: `${floorPct}%` }}
                title={`Keep ${d.tier}: ${fmtMoney(d.floor)}${heldFloor ? ' · cleared' : ' · not yet'}`} />
            )}
          </div>
          <div className="ov-pl">
            {(() => {
              const lines = tierTargetLines(d.tier, d.floor, d.nextTier, d.nextReq);
              if (lines.length === 0) return <div className="ov-plrow"><span>{fmtMoney(d.billed)} billed · top tier</span></div>;
              const target = d.nextReq ?? d.floor;
              return lines.map((ln, i) => (
                <div className="ov-plrow" key={i}>
                  <span>{fmtMoney(d.billed)} / {fmtMoney(ln.need)} to {ln.verb} {ln.tier}</span>
                  {ln.need === target && <span>{d.progress}%</span>}
                </div>
              ));
            })()}
          </div>
        </div>
      )}
      {verdict(d)}
    </div>
    {isOpenRow && <div className="ov-drill" onClick={(e) => e.stopPropagation()}><DealerCard userId={d._id} /></div>}
    </>
    );
  };

  // A capped group of rows with a "show N more" toggle.
  const Group = ({ region, gkey, dealers }: { region: string; gkey: string; dealers: DealerRow[] }) => {
    if (dealers.length === 0) return null;
    const key = `${region}:${gkey}`;
    const showAll = groupOpen(key) || dealers.length <= GROUP_CAP;
    const shown = showAll ? dealers : dealers.slice(0, GROUP_CAP);
    return (
      <>
        {shown.map((d) => <DealerLine d={d} key={d._id} />)}
        {!showAll && (
          <button className="ov-more" onClick={() => toggleGroup(key)}><Chevron sm /> Show {dealers.length - GROUP_CAP} more</button>
        )}
        {groupOpen(key) && dealers.length > GROUP_CAP && (
          <button className="ov-more" onClick={() => toggleGroup(key)}><Chevron sm open /> Show fewer</button>
        )}
      </>
    );
  };

  const kpi = (lab: string, val: number, cls: string, f: Filter) => (
    <button className={`kpi kpi-btn${cls}${filter === f ? ' on' : ''}`} onClick={() => setFilter((x) => x === f ? 'all' : f)}>
      <div className="k-lab">{lab}</div><div className="k-val num">{formatNumber(val)}</div>
    </button>
  );

  return (
    <>
      <div className="admin-head">
        <div><h1>Overview</h1><p className="page-sub">Welcome back, {auth.partyName ?? auth.username}.</p></div>
        <div className="admin-toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Search dealer — expands their region…" />
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {!data && !error && <div className="skeleton" style={{ height: 200 }} />}

      {data && (
        <>
          <div className="kpi-row kpi-row-5">
            <div className="kpi"><div className="k-lab">In-scheme dealers</div><div className="k-val num">{formatNumber(data.totals.dealers)}</div></div>
            <div className="kpi"><div className="k-lab">Billed this window</div><div className="k-val num" style={{ color: '#5BD6A0' }}>{formatNumber(data.totals.billing)}</div></div>
            {kpi('On track to promote', tally.promoting, ' okk', 'promoting')}
            {kpi('At risk of drop', tally.atRisk, ' riskk', 'atRisk')}
            {kpi('No bills this window', tally.dormant, ' dormk', 'dormant')}
          </div>

          <div className="chip-row" style={{ gap: 10 }}>
            <button className={`fchip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>All <b className="fc-n">{data.totals.dealers}</b></button>
            <button className={`fchip${filter === 'promoting' ? ' on' : ''}`} onClick={() => setFilter('promoting')}>▲ Promote <b className="fc-n">{tally.promoting}</b></button>
            <button className={`fchip${filter === 'holds' ? ' on' : ''}`} onClick={() => setFilter('holds')}>— Maintain <b className="fc-n">{tally.holds}</b></button>
            <button className={`fchip${filter === 'atRisk' ? ' on' : ''}`} onClick={() => setFilter('atRisk')}>▼ At risk <b className="fc-n">{tally.atRisk}</b></button>
            <button className={`fchip dorm${filter === 'dormant' ? ' on' : ''}`} onClick={() => setFilter('dormant')}>💤 No bills <b className="fc-n">{tally.dormant}</b></button>
          </div>

          {/* C — the focus strip: who to chase first, across every region */}
          {!q && filter === 'all' && focus.length > 0 && (
            <div className="ov-focus">
              <div className="ov-focus-h"><span className="ov-focus-t">⚑ Chase today</span><span className="hint">top {focus.length} by stake — dormant high-tier &amp; on the line</span></div>
              <div className="ov-focus-cards">
                {focus.map((d) => {
                  const short = Math.max(0, d.floor - d.billed);
                  const open = focusDealer === d._id;
                  return (
                    <Fragment key={d._id}>
                      <button className={`ov-fcard${open ? ' on' : ''}`} onClick={() => setFocusDealer(open ? null : d._id)}>
                        <div className="ov-fn">{d.partyName}</div>
                        <div className="ov-fr">{d.region} · <span style={{ color: TIER_ACCENT[d.tier] }}>{d.tier}</span>{d.noBills ? ' · 💤 ₹0' : ''}</div>
                        <div className={`ov-fwhy${d.noBills ? ' dorm' : ' risk'}`}>
                          {d.noBills ? `needs ${fmtMoney(d.floor)} to hold ${d.tier}` : `${fmtMoney(short)} short of ${d.tier}`}
                        </div>
                      </button>
                      {open && <div className="ov-drill ov-focus-drill"><DealerCard userId={d._id} /></div>}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {regions.length === 0 && <div className="empty"><b>No dealers match</b><span>Try a different filter or name.</span></div>}

          {regions.map((r) => {
            const dorm = r.dealers.filter(isDormant).sort((a, b) => rank(b.tier) - rank(a.tier));
            const risk = r.dealers.filter(isAtRiskBilled).sort((a, b) => a.progress - b.progress);
            const onTrack = r.dealers.filter((d) => !d.noBills && (d.status === 'holds' || d.status === 'promoting'));
            const promoting = onTrack.filter((d) => d.status === 'promoting');
            const holds = onTrack.filter((d) => d.status === 'holds');
            return (
              <div className="ov-region" key={r.region}>
                <button className={`ov-rh${isOpen(r.region) ? ' open' : ''}`} onClick={() => toggle(r.region)}>
                  <Chevron open={isOpen(r.region)} />
                  <span className="ov-rn">{r.region}{NEW_REGIONS.test(r.region) && <span className="ov-newtag">NEW territory</span>}</span>
                  <span className="ov-rmeta">
                    <span>{r.count} dealer{r.count === 1 ? '' : 's'}</span>
                    {dorm.length > 0 && <span className="pill-dorm">💤 {dorm.length}</span>}
                    {risk.length > 0 && <span className="pill-down">▼ {risk.length}</span>}
                    {promoting.length > 0 && <span className="pill-up">▲ {promoting.length}</span>}
                    <span>{fmtMoney(r.billed)}</span>
                  </span>
                </button>
                {isOpen(r.region) && (
                  <div className="ov-rbody">
                    {dorm.length > 0 && (
                      <>
                        <div className="ov-grp dorm">💤 No bills this window · <b>{dorm.length}</b> · chase first
                          <span className="ov-grp-note">sorted by tier — a dormant top-tier dealer is the biggest risk</span></div>
                        <Group region={r.region} gkey="dorm" dealers={dorm} />
                      </>
                    )}
                    {risk.length > 0 && (
                      <>
                        <div className="ov-grp risk">▼ At risk · billed, below the line · <b>{risk.length}</b></div>
                        <Group region={r.region} gkey="risk" dealers={risk} />
                      </>
                    )}
                    {onTrack.length > 0 && (
                      <>
                        <div className="ov-grp ok">— On track · <b>{onTrack.length}</b> · {promoting.length} promoting, {holds.length} holding</div>
                        <Group region={r.region} gkey="onTrack" dealers={onTrack} />
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
