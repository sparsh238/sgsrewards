import { Fragment, useEffect, useState } from 'react';
import { apiJson } from '../../lib/api';
import { formatNumber } from '../../lib/format';
import { type Tier } from '../../lib/tier';
import Chevron from '../../components/Chevron';
import DealerCard from './DealerCard';

interface TeamRep { _id: string; partyName: string; username: string; salesAreas: string[]; blocked: boolean; dealerCount: number }
interface TeamDealer { _id: string; partyName: string; phoneNumber: string; region?: string; tier: Tier; availablePoints: number }

// Sales Head only: the salespersons reporting to them, each expandable to the
// dealers that rep covers (which in turn open the full dealer drill-down card).
export default function SalesTeam() {
  const [team, setTeam] = useState<TeamRep[] | null>(null);
  const [error, setError] = useState('');
  const [openRep, setOpenRep] = useState<string | null>(null);
  const [dealers, setDealers] = useState<Record<string, TeamDealer[] | 'loading'>>({});
  const [openDealer, setOpenDealer] = useState<string | null>(null);

  useEffect(() => {
    apiJson<TeamRep[]>('/api/admin/team').then(setTeam).catch((e) => setError((e as Error).message));
  }, []);

  const toggleRep = (r: TeamRep) => {
    const next = openRep === r._id ? null : r._id;
    setOpenRep(next);
    setOpenDealer(null);
    if (next && !dealers[r._id]) {
      setDealers((d) => ({ ...d, [r._id]: 'loading' }));
      apiJson<TeamDealer[]>(`/api/admin/team/${r._id}/dealers`)
        .then((list) => setDealers((d) => ({ ...d, [r._id]: list })))
        .catch(() => setDealers((d) => ({ ...d, [r._id]: [] })));
    }
  };

  return (
    <>
      <div className="admin-head">
        <div><h1>Team</h1><p className="page-sub">Salespersons reporting to you. Expand one to see the dealers they cover.</p></div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {team === null && !error && <div className="skeleton" style={{ height: 200 }} />}

      {team !== null && (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Salesperson</th><th>Username</th><th>Areas</th><th>Dealers</th></tr></thead>
            <tbody>
              {team.map((r) => {
                const open = openRep === r._id;
                const ds = dealers[r._id];
                return (
                <Fragment key={r._id}>
                  <tr className={`row-click${open ? ' open' : ''}`}>
                    <td data-label="Salesperson">
                      <div className="t-strong">
                        <button className="caret-btn" aria-expanded={open} aria-label={open ? 'Collapse' : 'Expand'} onClick={() => toggleRep(r)}><Chevron open={open} /></button>
                        <button className="linklike" onClick={() => toggleRep(r)}>{r.partyName}</button>
                        {r.blocked && <span className="ro-tag">blocked</span>}
                      </div>
                    </td>
                    <td className="hint t-mono" data-label="Username">{r.username}</td>
                    <td className="hint" data-label="Areas">{r.salesAreas.join(', ') || '—'}</td>
                    <td className="t-num" data-label="Dealers">{formatNumber(r.dealerCount)}</td>
                  </tr>
                  {open && (
                    <tr className="row-detail"><td colSpan={4}>
                      {ds === undefined || ds === 'loading' ? (
                        <div className="skeleton" style={{ height: 80 }} />
                      ) : ds.length === 0 ? (
                        <p className="hint" style={{ padding: 12 }}>No dealers in this salesperson's scope.</p>
                      ) : (
                        <div className="dc-list">
                          {ds.map((d) => {
                            const dopen = openDealer === d._id;
                            return (
                            <div className="dc-litem" key={d._id}>
                              <div className="dc-lrow tappable" onClick={() => setOpenDealer(dopen ? null : d._id)}>
                                <div className="dc-lmain">
                                  <span className="t-strong"><Chevron open={dopen} sm />{d.partyName}</span>
                                  <span className="hint">{d.region || '—'} · {d.phoneNumber}</span>
                                </div>
                                <div className="dc-lmeta">
                                  <span className="hint">{d.tier}</span>
                                  <span className="t-num">{formatNumber(d.availablePoints)} pts</span>
                                </div>
                              </div>
                              {dopen && <div className="ov-drill" onClick={(e) => e.stopPropagation()}><DealerCard userId={d._id} /></div>}
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </td></tr>
                  )}
                </Fragment>
                );
              })}
              {team.length === 0 && <tr><td colSpan={4} className="hint" style={{ textAlign: 'center', padding: 30 }}>No salespersons are assigned to you yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
