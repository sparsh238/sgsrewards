interface Props {
  value: number;
  max: number;
  centerBig: string;   // big number in the well (e.g. "₹18L")
  centerSmall: string; // caption under it
  variant?: 'copper' | 'risk' | 'gold' | 'green';
  /** When set, fill uses this fraction directly instead of value/max. */
  frac?: number;
}

// Semicircle arc gauge. Fill = frac (if given) else value / max.
export default function Gauge({ value, max, centerBig, centerSmall, variant = 'copper', frac }: Props) {
  const f = Math.max(0, Math.min(1, frac ?? (max > 0 ? value / max : 0)));
  const ARC = 314; // π·r for r=100
  const offset = ARC * (1 - f);

  const grad = variant === 'risk'
    ? ['#9C4A3A', '#E06A5A']
    : variant === 'gold'
      ? ['#C69B3D', '#F1D488']
      : variant === 'green'
        ? ['#4E8E6E', '#74C39C']
        : ['#A5642F', '#EBAF74'];

  return (
    <div className="gauge">
      <svg width="230" height="132" viewBox="0 0 230 132" role="img" aria-label={`${centerBig} ${centerSmall}`}>
        <path d="M15 120 A100 100 0 0 1 215 120" fill="none" stroke="#262E3A" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M15 120 A100 100 0 0 1 215 120"
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={ARC}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
        />
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={grad[0]} />
            <stop offset="1" stopColor={grad[1]} />
          </linearGradient>
        </defs>
      </svg>
      <div className="gauge-center">
        <div className="gauge-big num">{centerBig}</div>
        <div className="gauge-small num">{centerSmall}</div>
      </div>
    </div>
  );
}
