import type { CSSProperties } from 'react';

// Admin/superadmin search box with a clear (✕) affordance that shows once there's
// text. Wrap carries the sizing (so it drops into a toolbar or a flex chip-row);
// the input fills it. Admin-only — not used on any dealer screen.
export default function SearchInput({ value, onChange, placeholder, style }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: CSSProperties;
}) {
  return (
    <div className="search-wrap" style={style}>
      <input className="input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" className="search-clear" aria-label="Clear search" title="Clear" onClick={() => onChange('')}>✕</button>
      )}
    </div>
  );
}
