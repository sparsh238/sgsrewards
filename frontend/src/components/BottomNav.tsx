import { NavLink } from 'react-router-dom';
import { useDealerTier } from '../lib/tierTheme';
import { useCart } from '../lib/cart';

const Icon = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const TROPHY_PATH = 'M6 3h12v2h3v2.5A4.5 4.5 0 0 1 16.9 12 5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 7.1 12 4.5 4.5 0 0 1 3 7.5V5h3V3zm0 4H5v.5A2.5 2.5 0 0 0 6 9.6V7zm12 0v2.6A2.5 2.5 0 0 0 19 7.5V7h-1z';

// Trophy — earned once the dealer reaches a tier.
const Trophy = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={TROPHY_PATH} />
  </svg>
);

// No Tier — the trophy with a diagonal slash cut through it ("not earned yet").
// The wide backing line is drawn in the coin's fill colour to carve a clean gap.
const TrophyOff = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={TROPHY_PATH} fill="currentColor" opacity="0.85" />
    <line x1="2.6" y1="2.2" x2="21.4" y2="21.8" stroke="var(--coin-bg)" strokeWidth="5.5" strokeLinecap="round" />
    <line x1="2.6" y1="2.2" x2="21.4" y2="21.8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

const items = [
  { to: '/home', label: 'Home', d: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z' },
  { to: '/shop', label: 'Shop', d: 'M4 7h16l-1.5 13a2 2 0 0 1-2 1.8h-9A2 2 0 0 1 5.5 20zM8 10V6a4 4 0 0 1 8 0v4' },
  { to: '/cart', label: 'Cart', d: 'M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2m8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2' },
  { to: '/profile', label: 'Profile', d: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10' },
];

export default function BottomNav() {
  const tier = useDealerTier();
  const { units } = useCart();
  const hasTrophy = !!tier && tier !== 'NoTier';

  return (
    <nav className="bottomnav" aria-label="Main">
      <NavLink to="/home" className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}>
        <Icon d={items[0].d} />{items[0].label}
      </NavLink>
      <NavLink to="/shop" className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}>
        <Icon d={items[1].d} />{items[1].label}
      </NavLink>

      {/* Tier — a raised coin spilling up out of the nav, in the tier's metal. */}
      <NavLink to="/tier" className={({ isActive }) => `bn-item bn-tier${isActive ? ' active' : ''}`}>
        <span className={`bn-coin${hasTrophy ? '' : ' notier'}`}>
          {hasTrophy ? <Trophy /> : <TrophyOff />}
        </span>
        <span className="bn-coin-spacer" aria-hidden="true" />
        <span className="bn-tierlabel">Tier</span>
      </NavLink>

      <NavLink to="/cart" className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}>
        <span className="bn-cart-ico">
          <Icon d={items[2].d} />
          {units > 0 && <span className="bn-badge num">{units}</span>}
        </span>
        {items[2].label}
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}>
        <Icon d={items[3].d} />{items[3].label}
      </NavLink>
    </nav>
  );
}
