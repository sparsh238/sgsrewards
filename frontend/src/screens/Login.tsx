import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { useAuth, homeForRole, type UserType } from '../lib/auth';
import PinInput from '../components/PinInput';
import AuthHeader from '../components/AuthHeader';

interface LoginResponse {
  user: { username: string; userType: UserType; partyName: string; isPasswordReset: boolean };
  token: string;
  refreshToken: string;
}

type Mode = 'dealer' | 'staff';

export default function Login() {
  const [mode, setMode] = useState<Mode>('dealer');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const afterLogin = (data: LoginResponse) => {
    // Store everything (incl. isPasswordReset); the route guards send the user
    // to set-pin / reset-password when needed — no imperative navigation race.
    login(data.refreshToken, data.user.username, data.user.userType, data.user.partyName, data.user.isPasswordReset);
    navigate(homeForRole(data.user.userType), { replace: true });
  };

  const submitDealer = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) { setError('Enter your 4-digit PIN.'); return; }
    setBusy(true);
    try {
      const data = await apiJson<LoginResponse>('/api/auth/login-pin', {
        method: 'POST',
        json: { phoneNumber: phone.trim(), pin },
      });
      afterLogin(data);
    } catch (err) {
      setError((err as Error).message);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const submitStaff = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await apiJson<LoginResponse>('/api/auth/login', {
        method: 'POST',
        json: { username, password },
      });
      afterLogin(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-inner">
        <AuthHeader
          title="Your billing, rewarded."
          subtitle={mode === 'dealer' ? 'Sign in with your phone & PIN' : 'Staff sign in'}
        />

        {error && <div className="error-banner" role="alert">{error}</div>}

        {mode === 'dealer' ? (
          <>
            <form onSubmit={submitDealer} className="auth-card">
              <div className="field">
                <label htmlFor="phone">Phone number</label>
                <input
                  id="phone" className="input num" inputMode="numeric" autoComplete="tel"
                  placeholder="10-digit mobile number"
                  value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} required
                />
              </div>
              <div className="field">
                <label>PIN</label>
                <PinInput value={pin} onChange={setPin} ariaLabel="PIN" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <button type="button" className="link-btn" onClick={() => { setMode('staff'); setError(''); }}>
              Staff login
            </button>
          </>
        ) : (
          <>
            <form onSubmit={submitStaff} className="auth-card">
              <div className="field">
                <label htmlFor="username">Username</label>
                <input id="username" className="input" autoComplete="username"
                  value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input id="password" className="input" type="password" autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <button type="button" className="link-btn" onClick={() => { setMode('dealer'); setError(''); }}>
              Dealer login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
