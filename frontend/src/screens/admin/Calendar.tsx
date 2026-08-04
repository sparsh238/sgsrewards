import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';

interface CalEvent { name: string; phone: string; tier: string; region: string; type: 'birthday' | 'anniversary'; month: number; day: number }
interface CalData { events: CalEvent[]; missing: number; totalDealers: number }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const icon = (t: string) => (t === 'birthday' ? '🎂' : '💍');

export default function Calendar() {
  const [data, setData] = useState<CalData | null>(null);
  const [error, setError] = useState('');
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<'month' | 'upcoming'>('month');
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 }); // m: 1-12
  const [type, setType] = useState<'all' | 'birthday' | 'anniversary'>('all');
  const [region, setRegion] = useState('');

  useEffect(() => {
    apiJson<CalData>('/api/admin/calendar').then(setData).catch((e) => setError((e as Error).message));
  }, []);

  const regions = useMemo(() => (data ? [...new Set(data.events.map((e) => e.region).filter(Boolean))].sort() : []), [data]);
  const filtered = useMemo(() => (data?.events ?? []).filter((e) =>
    (type === 'all' || e.type === type) && (!region || e.region === region)), [data, type, region]);

  const grid = useMemo(() => {
    const lead = new Date(cursor.y, cursor.m - 1, 1).getDay();
    const days = new Date(cursor.y, cursor.m, 0).getDate();
    const byDay: Record<number, CalEvent[]> = {};
    for (const e of filtered) if (e.month === cursor.m) (byDay[e.day] ??= []).push(e);
    const cells: Array<{ day: number; events: CalEvent[] } | null> = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push({ day: d, events: byDay[d] ?? [] });
    return cells;
  }, [filtered, cursor]);

  const upcoming = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return filtered
      .map((e) => {
        let occ = new Date(today.getFullYear(), e.month - 1, e.day);
        if (occ < start) occ = new Date(today.getFullYear() + 1, e.month - 1, e.day);
        return { e, occ, days: Math.round((occ.getTime() - start.getTime()) / 86400000) };
      })
      .filter((x) => x.days <= 30)
      .sort((a, b) => a.days - b.days);
  }, [filtered, today]);

  const isToday = (d: number) => cursor.y === today.getFullYear() && cursor.m === today.getMonth() + 1 && d === today.getDate();
  const shiftMonth = (delta: number) => setCursor((c) => {
    const m = c.m + delta;
    if (m < 1) return { y: c.y - 1, m: 12 };
    if (m > 12) return { y: c.y + 1, m: 1 };
    return { ...c, m };
  });
  const dayLabel = (days: number) => (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`);

  return (
    <>
      <div className="admin-head">
        <div><h1>Calendar</h1><p className="page-sub">Dealer birthdays &amp; anniversaries — reach out with a wish or an offer.</p></div>
        <div className="admin-toolbar">
          <select className="input" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value as 'all' | 'birthday' | 'anniversary')}>
            <option value="all">🎂 💍 All</option>
            <option value="birthday">🎂 Birthdays</option>
            <option value="anniversary">💍 Anniversaries</option>
          </select>
          <select className="input" style={{ width: 'auto' }} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">All areas</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {!data && !error && <div className="skeleton" style={{ height: 300 }} />}

      {data && (
        <>
          <div className="admin-tabs">
            <button className={`atab${view === 'month' ? ' on' : ''}`} onClick={() => setView('month')}>Month</button>
            <button className={`atab${view === 'upcoming' ? ' on' : ''}`} onClick={() => setView('upcoming')}>Upcoming 30 days <b>{upcoming.length}</b></button>
          </div>

          {data.missing > 0 && (
            <div className="ov-note" role="note"><b>{data.missing}</b> of {data.totalDealers} dealers have no birthday or anniversary on file yet.</div>
          )}

          {view === 'month' ? (
            <div className="cal-wrap">
              <div className="cal-monthhead">
                <button className="mini-btn" onClick={() => shiftMonth(-1)}>‹ Prev</button>
                <div className="cal-title">{MONTHS[cursor.m - 1]} {cursor.y}</div>
                <button className="mini-btn" onClick={() => shiftMonth(1)}>Next ›</button>
              </div>
              <div className="cal-grid cal-wd">{WEEKDAYS.map((w) => <div key={w} className="cal-wdc">{w}</div>)}</div>
              <div className="cal-grid">
                {grid.map((c, i) => (c === null ? <div key={i} className="cal-cell empty" /> : (
                  <div key={i} className={`cal-cell${isToday(c.day) ? ' today' : ''}`}>
                    <div className="cal-daynum">{c.day}</div>
                    {c.events.map((e, j) => (
                      <div key={j} className={`cal-ev ${e.type}`} title={`${e.name} · ${e.phone}${e.region ? ' · ' + e.region : ''}`}>
                        {icon(e.type)} {e.name}
                      </div>
                    ))}
                  </div>
                )))}
              </div>
            </div>
          ) : (
            <div className="cal-up">
              {upcoming.length === 0 && <div className="empty"><b>Nothing in the next 30 days</b><span>Try a different filter.</span></div>}
              {upcoming.map(({ e, occ, days }, i) => (
                <div key={i} className="cal-uprow">
                  <div className={`cal-upicon ${e.type}`}>{icon(e.type)}</div>
                  <div className="cal-upmain">
                    <div className="cal-upname">{e.name}</div>
                    <div className="hint">{e.type === 'birthday' ? 'Birthday' : 'Anniversary'}{e.region ? ` · ${e.region}` : ''} · {e.phone}</div>
                  </div>
                  <div className="cal-upwhen">
                    <div className={`cal-updays${days <= 1 ? ' soon' : ''}`}>{dayLabel(days)}</div>
                    <div className="hint">{occ.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
