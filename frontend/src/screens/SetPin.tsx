import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { useAuth, homeForRole } from '../lib/auth';
import PinInput from '../components/PinInput';
import AuthHeader from '../components/AuthHeader';

// Dealer sets their own 4-digit PIN — on first login or after a superadmin reset.
export default function SetPin() {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { auth, markSetupDone } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) { setError('Choose a 4-digit PIN.'); return; }
    if (pin !== confirm) { setError("PINs don't match."); return; }
    setBusy(true);
    try {
      await apiJson('/api/user/set-pin', { method: 'POST', json: { pin } });
      markSetupDone();
      navigate(homeForRole(auth.userType), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-inner">
        <AuthHeader title="Set your PIN" subtitle="Choose a 4-digit PIN you'll use to sign in from now on." />

        {error && <div className="error-banner" role="alert">{error}</div>}

        <form onSubmit={submit} className="auth-card" style={{ gap: 18 }}>
          <div className="field">
            <label>New PIN</label>
            <PinInput value={pin} onChange={setPin} autoFocus ariaLabel="New PIN" />
          </div>
          <div className="field">
            <label>Confirm PIN</label>
            <PinInput value={confirm} onChange={setConfirm} ariaLabel="Confirm PIN" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save PIN'}
          </button>
        </form>
      </div>
    </div>
  );
}
