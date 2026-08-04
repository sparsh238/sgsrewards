import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { useAuth, homeForRole } from '../lib/auth';
import AuthHeader from '../components/AuthHeader';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { auth, markSetupDone } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await apiJson('/api/user/change-password', { method: 'POST', json: { newPassword } });
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
        <AuthHeader title="Set a new password" subtitle="Choose a password only you know — you'll use it from now on." />

        {error && <div className="error-banner" role="alert">{error}</div>}

        <form onSubmit={submit} className="auth-card">
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input id="new-password" className="input" type="password" autoComplete="new-password"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Confirm password</label>
            <input id="confirm-password" className="input" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  );
}
