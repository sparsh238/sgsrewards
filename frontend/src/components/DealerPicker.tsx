import { useEffect, useMemo, useRef, useState } from 'react';
import type { Tier } from '../lib/tier';
import { matchesSearch } from '../lib/search';

export interface PickDealer { _id: string; username: string; partyName: string; tier: Tier; region?: string }

// Searchable dealer picker — replaces a native <select> that was unusable with
// 200+ dealers. Type to filter by name / username / area; arrow keys + Enter to
// pick; click the selected chip to change it.
export default function DealerPicker({ dealers, value, onChange, autoFocus }: {
  dealers: PickDealer[];
  value: string;
  onChange: (id: string) => void;
  autoFocus?: boolean;
}) {
  const selected = dealers.find((d) => d._id === value) || null;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const CAP = 60;
  const { results, total } = useMemo(() => {
    const list = !q.trim() ? dealers : dealers.filter((d) =>
      matchesSearch(d.partyName, q) || matchesSearch(d.username, q) || matchesSearch(d.region ?? '', q));
    return { results: list.slice(0, CAP), total: list.length };
  }, [dealers, q]);

  useEffect(() => { setActive(0); }, [q]);
  // keep the active option in view while arrowing
  useEffect(() => { listRef.current?.querySelector('.dpick-opt.active')?.scrollIntoView({ block: 'nearest' }); }, [active, open]);

  const choose = (d: PickDealer) => { onChange(d._id); setOpen(false); setQ(''); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (open && results[active]) { e.preventDefault(); choose(results[active]); } }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="dpick" ref={wrapRef}>
      {selected && !open ? (
        <button type="button" className="input dpick-selected" onClick={() => { setOpen(true); setQ(''); setTimeout(() => inputRef.current?.focus(), 0); }}>
          <span className="dpick-seltext"><b>{selected.partyName}</b> <span className="hint">({selected.username}) · {selected.tier}</span></span>
          <span className="dpick-change">change</span>
        </button>
      ) : (
        <input ref={inputRef} className="input" autoFocus={autoFocus}
          placeholder="Search dealer by name, username or area…"
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
      )}
      {open && (
        <div className="dpick-menu" ref={listRef}>
          {results.length === 0 ? (
            <div className="dpick-empty">No dealers match “{q.trim()}”.</div>
          ) : results.map((d, i) => (
            <button type="button" key={d._id}
              className={`dpick-opt${i === active ? ' active' : ''}${d._id === value ? ' sel' : ''}`}
              onMouseEnter={() => setActive(i)} onClick={() => choose(d)}>
              <span className="dpick-nm">{d.partyName}</span>
              <span className="dpick-meta">{d.username} · {d.tier}{d.region ? ` · ${d.region}` : ''}</span>
            </button>
          ))}
          {total > results.length && <div className="dpick-more">Showing {results.length} of {total} — keep typing to narrow.</div>}
        </div>
      )}
    </div>
  );
}
