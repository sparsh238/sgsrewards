import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { formatNumber } from '../lib/format';
import { itemPrice, type Item } from '../lib/types';
import ItemCard, { rewardState } from '../components/ItemCard';

type Filter = 'all' | 'qualified' | 'goal';
type SortDir = 'asc' | 'desc';

const paramToFilter = (v: string | null): Filter =>
  v === 'reach' || v === 'qualified' ? 'qualified' : v === 'goal' ? 'goal' : 'all';

export default function Shop() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>(paramToFilter(searchParams.get('filter')));
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, pts] = await Promise.all([
          apiJson<Item[]>('/api/item'),
          apiJson<{ availablePoints: number }>('/api/user/points'),
        ]);
        if (cancelled) return;
        setItems(list);
        setPoints(pts.availablePoints);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...(items ?? [])]
      .filter((it) => !q || it.name.toLowerCase().includes(q))
      .sort((a, b) => (sortDir === 'asc' ? itemPrice(a) - itemPrice(b) : itemPrice(b) - itemPrice(a)));
    const qualified: Item[] = [], goal: Item[] = [], unavailable: Item[] = [];
    for (const it of sorted) {
      const s = rewardState(it, points);
      if (s === 'qualified') qualified.push(it);
      else if (s === 'goal') goal.push(it);
      else unavailable.push(it);
    }
    return { qualified, goal, unavailable };
  }, [items, query, points, sortDir]);

  const cards = (list: Item[]) =>
    list.map((it) => <ItemCard key={it._id} item={it} availablePoints={points} />);

  const showQual = filter === 'all' || filter === 'qualified';
  const showGoal = filter === 'all' || filter === 'goal';
  const nothing = items !== null &&
    (filter === 'qualified' ? groups.qualified.length === 0
      : filter === 'goal' ? groups.goal.length === 0
      : groups.qualified.length + groups.goal.length + groups.unavailable.length === 0);

  return (
    <div className="page">
      <div className="spread">
        <h1 className="page-title">Rewards</h1>
        <div className="shop-points">
          <span className="sp-lab">Your points</span>
          <span className="sp-val num">{points === null ? '—' : formatNumber(points)}</span>
        </div>
      </div>

      <input
        className="input"
        placeholder="Search rewards…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search rewards"
      />

      <div className="shop-filter">
        <div className="seg-tabs" role="tablist" aria-label="Filter rewards">
          <button role="tab" aria-selected={filter === 'all'} className={`seg-tab${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button role="tab" aria-selected={filter === 'qualified'} className={`seg-tab${filter === 'qualified' ? ' on' : ''}`} onClick={() => setFilter('qualified')}>Qualified</button>
          <button role="tab" aria-selected={filter === 'goal'} className={`seg-tab${filter === 'goal' ? ' on on-goal' : ''}`} onClick={() => setFilter('goal')}>Goal</button>
        </div>
        <button className="sort-btn" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
          ↕ {sortDir === 'asc' ? 'Low–High' : 'High–Low'}
        </button>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      {items === null && !error && (
        <div className="reward-list">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 140 }} />)}
        </div>
      )}

      {nothing && (
        <div className="empty">
          <span className="big" aria-hidden="true">🛍</span>
          <b>{filter === 'qualified' ? 'Nothing you qualify for yet' : filter === 'goal' ? 'No goals to show' : 'No rewards found'}</b>
          <span>{filter === 'qualified' ? 'Keep billing — your points are growing.' : 'Try a different search.'}</span>
        </div>
      )}

      {showQual && groups.qualified.length > 0 && (
        <>
          <div className="group-head qual">
            <span className="gh-title">✓ Qualified <span className="gh-count">· {groups.qualified.length}</span></span>
          </div>
          <div className="reward-list">{cards(groups.qualified)}</div>
        </>
      )}

      {showGoal && groups.goal.length > 0 && (
        <>
          <div className="group-head goal">
            <span className="gh-title">◆ Save up for these <span className="gh-count">· {groups.goal.length}</span></span>
          </div>
          <div className="reward-list">{cards(groups.goal)}</div>
        </>
      )}

      {filter === 'all' && groups.unavailable.length > 0 && (
        <>
          <div className="group-head">
            <span className="gh-title muted">Currently unavailable</span>
          </div>
          <div className="reward-list">{cards(groups.unavailable)}</div>
        </>
      )}
    </div>
  );
}
