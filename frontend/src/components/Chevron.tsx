// Shared expand/collapse chevron — a rounded chip that rotates 90° and fills
// copper when open. Same treatment as the Orders detail toggle; reused across
// every expandable row (Bills, Users, Overview, DealerCard).
export default function Chevron({
  open = false,
  sm = false,
  className = '',
}: {
  open?: boolean;
  sm?: boolean;
  className?: string;
}) {
  return (
    <span className={`chev-chip${sm ? ' sm' : ''}${open ? ' open' : ''}${className ? ' ' + className : ''}`} aria-hidden="true">
      <svg viewBox="0 0 10 10"><path d="M3 1 L7 5 L3 9" /></svg>
    </span>
  );
}
