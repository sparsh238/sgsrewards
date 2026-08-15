import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatNumber, formatRupees } from '../lib/format';
import {
  computeNudge, quarterLabel, thisMonth, thisQuarter, monthLabel,
  type Bill, type Nudge, type PointsConversions, type Tier, type TierRequirements,
} from '../lib/tier';
import MetalCard from '../components/MetalCard';
import TierNudge from '../components/TierNudge';
import SpinHomeCard from '../components/SpinHomeCard';
import { isAvailable, itemPrice, type Item } from '../lib/types';

interface Profile {
  partyName: string;
  availablePoints: number;
  tier: Tier;
  inScheme?: boolean;
}

export default function Home() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [month, setMonth] = useState<{ billed: number; earned: number } | null>(null);
  const [quarter, setQuarter] = useState<{ billed: number; earned: number } | null>(null);
  const [reachable, setReachable] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prof, bills, reqs, conv, items] = await Promise.all([
          apiJson<Profile>('/api/user/profile'),
          apiJson<Bill[]>('/api/bill/user'),
          apiJson<{ tierBillingRequirements: TierRequirements }>('/api/superadmin/system/tier-billing-requirements'),
          apiJson<{ tierPointsConversion: PointsConversions }>('/api/superadmin/system/points-conversion'),
          apiJson<Item[]>('/api/item'),
        ]);
        if (cancelled) return;
        setProfile(prof);
        setNudge(computeNudge(prof.tier, bills, reqs.tierBillingRequirements, conv.tierPointsConversion || {}));
        setMonth(thisMonth(bills));
        setQuarter(thisQuarter(bills));
        setReachable(items.filter(isAvailable).filter((i) => itemPrice(i) <= prof.availablePoints).length);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page">
      <div>
        <div className="greet">Namaste 👋</div>
        <div className="party">{auth.partyName ?? auth.username}</div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      {profile ? (
        <MetalCard tier={profile.tier} partyName={profile.partyName} />
      ) : (
        <div className="skeleton" style={{ height: 120 }} />
      )}

      {profile?.inScheme === false && (
        <div className="redeem-only" role="note">
          <span className="ro-icon">🎁</span>
          <div>
            <b>Redeem-only account</b>
            <p>You can redeem your points anytime — but this account doesn’t earn new points.</p>
          </div>
        </div>
      )}

      {profile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="points-line">
            <span className="points-val num">{formatNumber(profile.availablePoints)}</span>
            <span className="points-lab">points available</span>
          </div>
          {reachable !== null && reachable > 0 && (
            <Link to="/shop?filter=reach" className="gifts-line">
              🎁 <span className="num">{reachable}</span> reward{reachable === 1 ? '' : 's'} can be redeemed!
              <span className="arr">→</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="skeleton" style={{ height: 40, width: '60%' }} />
      )}

      {/* Earn UI (gauge + billing stats) only for in-scheme dealers; out-of-scheme redeem only. */}
      {profile?.inScheme !== false && (nudge && profile
        ? <TierNudge nudge={nudge} onOpen={() => navigate('/tier')} />
        : <div className="skeleton" style={{ height: 240 }} />)}

      {/* Daily-spin nudge — below the gauge so it never displaces the speedometer. */}
      <SpinHomeCard />

      {/* Billing motivation — this month and this quarter */}
      {profile?.inScheme !== false && month && quarter && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>This month · {monthLabel()}</div>
            <div className="month-grid">
              <div className="month-stat">
                <div className="ms-val num">{formatRupees(month.billed)}</div>
                <div className="ms-lab">billed</div>
              </div>
              <div className="month-stat">
                <div className="ms-val num accent">{formatNumber(month.earned)}</div>
                <div className="ms-lab">points earned</div>
              </div>
            </div>
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>This quarter · {quarterLabel()}</div>
            <div className="month-grid">
              <div className="month-stat">
                <div className="ms-val num">{formatRupees(quarter.billed)}</div>
                <div className="ms-lab">billed</div>
              </div>
              <div className="month-stat">
                <div className="ms-val num accent">{formatNumber(quarter.earned)}</div>
                <div className="ms-lab">points earned</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Link to="/shop" className="btn btn-primary" style={{ marginTop: 'auto' }}>
        Browse rewards
      </Link>
    </div>
  );
}
