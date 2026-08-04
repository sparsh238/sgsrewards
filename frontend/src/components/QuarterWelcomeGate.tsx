import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api';
import { TIER_ORDER, type PointsConversions, type Tier, type TierRequirements } from '../lib/tier';
import QuarterWelcome from './QuarterWelcome';

interface Profile {
  tier: Tier;
  previousTier: Tier | null;
  tierWelcomeSeen: boolean;
  partyName: string;
}

const isTier = (v: unknown): v is Tier => typeof v === 'string' && (TIER_ORDER as readonly string[]).includes(v);

// Shows the tier-welcome exactly once after a superadmin changes a dealer's tier.
// The backend flags `tierWelcomeSeen=false` on a real change and records the
// `previousTier`; we reveal it and POST an ack to clear the flag.
export default function QuarterWelcomeGate() {
  const [data, setData] = useState<{
    profile: Profile;
    earnRates: PointsConversions;
    requirements: TierRequirements;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // No ref guard: StrictMode runs the effect twice; gate only the state-set so
    // the second mount's fetch result survives (see ProfileGate for the rationale).
    let alive = true;
    (async () => {
      try {
        const [profile, reqs, conv] = await Promise.all([
          apiJson<Profile>('/api/user/profile'),
          apiJson<{ tierBillingRequirements: TierRequirements }>('/api/superadmin/system/tier-billing-requirements'),
          apiJson<{ tierPointsConversion: PointsConversions }>('/api/superadmin/system/points-conversion'),
        ]);
        if (alive) setData({
          profile,
          earnRates: conv.tierPointsConversion || {},
          requirements: reqs.tierBillingRequirements || {},
        });
      } catch { /* no welcome without data */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!data || dismissed) return null;
  const { profile, earnRates, requirements } = data;

  // Only when the backend says there's an unseen tier change.
  const pending = profile.tierWelcomeSeen === false && isTier(profile.previousTier) && profile.previousTier !== profile.tier;
  if (!pending) return null;

  const dismiss = () => {
    setDismissed(true);
    void apiJson('/api/user/tier-welcome-seen', { method: 'POST' }).catch(() => { /* best-effort ack */ });
  };

  return (
    <QuarterWelcome
      tier={profile.tier}
      prevTier={profile.previousTier as Tier}
      partyName={profile.partyName ?? 'Your firm'}
      earnRates={earnRates}
      requirements={requirements}
      onDismiss={dismiss}
    />
  );
}
