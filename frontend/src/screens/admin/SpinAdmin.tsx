import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatNumber } from '../../lib/format';
import { TIER_ORDER } from '../../lib/tier';

interface Seg { label: string; points: number; weight: number }
interface Config { enabled: boolean; entryFee: number; minTierRank: number; segments: Seg[]; isDefault: boolean }
interface LogRow { _id: string; partyName: string; tier: string; entryFee: number; prize: number; createdAt: string }
interface Stats { spins: number; entry: number; paid: number; net: number }
interface LogResp { items: LogRow[]; total: number; stats: Stats; today: Stats }

const MIN_TIERS = TIER_ORDER.map((t, i) => ({ t, rank: i })).filter((x) => x.rank >= 1); // Basic+ (NoTier never eligible)

export default function SpinAdmin() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [log, setLog] = useState<LogResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { toast, toastError } = useToast();

  const loadAll = () => {
    apiJson<Config>('/api/superadmin/spin-config').then(setCfg).catch((e) => setError((e as Error).message));
    apiJson<LogResp>('/api/superadmin/spin-log').then(setLog).catch(() => {});
  };
  useEffect(() => { loadAll(); }, []);

  const ev = useMemo(() => {
    if (!cfg) return { total: 0, avg: 0, net: 0 };
    const total = cfg.segments.reduce((a, s) => a + Math.max(0, s.weight), 0);
    const avg = total > 0 ? cfg.segments.reduce((a, s) => a + s.points * Math.max(0, s.weight), 0) / total : 0;
    return { total, avg, net: avg - cfg.entryFee };
  }, [cfg]);

  const setSeg = (i: number, patch: Partial<Seg>) => setCfg((c) => c && ({ ...c, segments: c.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const addSeg = () => setCfg((c) => c && ({ ...c, segments: [...c.segments, { label: 'New', points: 0, weight: 1 }] }));
  const delSeg = (i: number) => setCfg((c) => c && ({ ...c, segments: c.segments.filter((_, j) => j !== i) }));

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    try {
      const saved = await apiJson<Config>('/api/superadmin/spin-config', { method: 'PUT', json: cfg });
      setCfg(saved);
      toast('Spin config saved');
    } catch (err) { toastError((err as Error).message); }
    finally { setBusy(false); }
  };

  const pct = (w: number) => (ev.total > 0 ? `${((Math.max(0, w) / ev.total) * 100).toFixed(1)}%` : '—');
  const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const money = (n: number) => formatNumber(n);

  return (
    <>
      <div className="admin-head">
        <div><h1>Daily Spin</h1><p className="page-sub">Prize odds &amp; payout audit. Dealers never see the weights.</p></div>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {!cfg ? <div className="skeleton" style={{ height: 300 }} /> : (
        <>
          {/* Payout stats */}
          {log && (
            <div className="month-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              <div className="month-stat"><div className="ms-val num">{formatNumber(log.stats.spins)}</div><div className="ms-lab">spins all-time · {formatNumber(log.today.spins)} today</div></div>
              <div className="month-stat"><div className="ms-val num">{money(log.stats.entry)}</div><div className="ms-lab">entry collected</div></div>
              <div className="month-stat"><div className="ms-val num accent">{money(log.stats.paid)}</div><div className="ms-lab">points paid out</div></div>
              <div className="month-stat"><div className="ms-val num" style={{ color: log.stats.net > 0 ? 'var(--danger)' : 'var(--ok)' }}>{log.stats.net > 0 ? '+' : ''}{money(log.stats.net)}</div><div className="ms-lab">net liability</div></div>
            </div>
          )}

          {/* Config editor */}
          <div className="table-wrap" style={{ padding: 16, marginTop: 4 }}>
            <div className="scheme-toggle" style={{ marginBottom: 14 }}>
              <div><div className="st-title">Spin enabled</div><div className="st-sub">{cfg.enabled ? 'Dealers can play the daily spin.' : 'The wheel is turned off for everyone.'}{cfg.isDefault ? ' · using the default table' : ''}</div></div>
              <button type="button" className={`switch${cfg.enabled ? ' on' : ''}`} role="switch" aria-checked={cfg.enabled} onClick={() => setCfg((c) => c && ({ ...c, enabled: !c.enabled }))} />
            </div>
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="field"><label htmlFor="ef">Entry fee (points)</label><input id="ef" className="input" type="number" min={0} value={cfg.entryFee} onChange={(e) => setCfg((c) => c && ({ ...c, entryFee: Math.max(0, Number(e.target.value) || 0) }))} /></div>
              <div className="field"><label htmlFor="mt">Minimum tier</label>
                <select id="mt" className="input" value={cfg.minTierRank} onChange={(e) => setCfg((c) => c && ({ ...c, minTierRank: Number(e.target.value) }))}>
                  {MIN_TIERS.map((x) => <option key={x.rank} value={x.rank}>{x.t} and up</option>)}
                </select>
              </div>
            </div>

            <div className="section-label" style={{ marginBottom: 6 }}>Prize slices &amp; weights</div>
            <table className="data">
              <thead><tr><th>Label</th><th>Points</th><th>Weight</th><th>Chance</th><th></th></tr></thead>
              <tbody>
                {cfg.segments.map((s, i) => (
                  <tr key={i}>
                    <td data-label="Label"><input className="input" style={{ padding: '6px 8px' }} value={s.label} onChange={(e) => setSeg(i, { label: e.target.value })} /></td>
                    <td data-label="Points"><input className="input" style={{ padding: '6px 8px', width: 90 }} type="number" min={0} value={s.points} onChange={(e) => setSeg(i, { points: Math.max(0, Number(e.target.value) || 0) })} /></td>
                    <td data-label="Weight"><input className="input" style={{ padding: '6px 8px', width: 90 }} type="number" min={0} step="0.1" value={s.weight} onChange={(e) => setSeg(i, { weight: Math.max(0, Number(e.target.value) || 0) })} /></td>
                    <td className="hint t-num" data-label="Chance">{pct(s.weight)}</td>
                    <td className="cell-actions"><button className="mini-btn danger" onClick={() => delSeg(i)} disabled={cfg.segments.length <= 2}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="mini-btn" style={{ marginTop: 10 }} onClick={addSeg}>+ Add slice</button>

            <div className="scheme-toggle" style={{ marginTop: 14 }}>
              <div>
                <div className="st-title">Average payout ≈ <b className="t-num">{ev.avg.toFixed(1)}</b> pts / spin</div>
                <div className="st-sub">vs {cfg.entryFee} entry → <b style={{ color: ev.net > 0.5 ? 'var(--danger)' : 'var(--ok)' }}>{ev.net >= 0 ? 'net +' : 'net '}{ev.net.toFixed(1)}</b> {ev.net > 0.5 ? 'per spin (costs points)' : ev.net < -0.5 ? 'per spin (points sink)' : '≈ neutral'}</div>
              </div>
              <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save config'}</button>
            </div>
          </div>

          {/* Recent spins */}
          <div className="section-label" style={{ margin: '22px 0 8px' }}>Recent spins {log ? `· ${formatNumber(log.total)} total` : ''}</div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Dealer</th><th>Tier</th><th>Entry</th><th>Won</th><th>When</th></tr></thead>
              <tbody>
                {log?.items.map((r) => (
                  <tr key={r._id}>
                    <td className="t-strong" data-label="Dealer">{r.partyName || '—'}</td>
                    <td className="hint" data-label="Tier">{r.tier}</td>
                    <td className="hint t-num" data-label="Entry">−{r.entryFee}</td>
                    <td className="t-num" data-label="Won" style={{ color: r.prize > 0 ? 'var(--copper-hi)' : 'var(--muted)' }}>{r.prize > 0 ? `+${formatNumber(r.prize)}` : '—'}</td>
                    <td className="hint" data-label="When">{when(r.createdAt)}</td>
                  </tr>
                ))}
                {log && log.items.length === 0 && <tr><td colSpan={5} className="hint" style={{ textAlign: 'center', padding: 30 }}>No spins yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
