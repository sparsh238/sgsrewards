import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api';

interface Profile {
  profileCompleted?: boolean;
  firstName?: string;
  lastName?: string;
  partyName: string;
}

// First-login capture. Blocks the app until the dealer submits first/last name
// and DOB (anniversary optional). Existing accounts have profileCompleted absent
// -> treated as incomplete, so they see it once too. Mirrors QuarterWelcomeGate's
// single-fetch/ack pattern.
export default function ProfileGate() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [done, setDone] = useState(false);

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [dob, setDob] = useState('');
  const [anniv, setAnniv] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // No ref guard: under StrictMode the effect runs twice; gating only the
    // state-set (not the fetch) keeps the second mount's result. GET is idempotent.
    let alive = true;
    apiJson<Profile>('/api/user/profile')
      .then((p) => { if (alive) setProfile(p); })
      .catch(() => { /* if profile can't load, don't block the app */ });
    return () => { alive = false; };
  }, []);

  if (!profile || done || profile.profileCompleted) return null;

  const submit = async () => {
    if (!first.trim() || !last.trim()) { setError('First and last name are required'); return; }
    if (!dob) { setError('Date of birth is required'); return; }
    setSaving(true); setError('');
    try {
      await apiJson('/api/user/complete-profile', {
        method: 'POST',
        json: { firstName: first.trim(), lastName: last.trim(), dateOfBirth: dob, anniversaryDate: anniv || null },
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pg-overlay" role="dialog" aria-modal="true">
      <div className="pg-card">
        <div className="pg-step">Complete your profile</div>
        <h2 className="pg-title">Tell us about you</h2>
        <p className="pg-blurb">So we can wish you on the days that matter.</p>

        <label className="pg-label">First name</label>
        <input className="input" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" />
        <label className="pg-label">Last name</label>
        <input className="input" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" />
        <label className="pg-label">Date of birth</label>
        <input className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        <label className="pg-label">Anniversary <span className="pg-opt">· optional</span></label>
        <input className="input" type="date" value={anniv} onChange={(e) => setAnniv(e.target.value)} />

        {error && <p className="pg-error">{error}</p>}
        <button className="btn btn-primary pg-save" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save & continue'}
        </button>
      </div>
    </div>
  );
}
