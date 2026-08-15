import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { formatNumber } from '../lib/format';
import { useSpin } from '../lib/spin';

interface SpinResult { segmentIndex: number; prize: number; entryFee: number; newBalance: number; nextResetAt: string }

const fmtCountdown = (iso?: string): string => {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function Spin() {
  const { status, refresh } = useSpin();
  const navigate = useNavigate();
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>('idle');
  const [result, setResult] = useState<SpinResult | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [countdown, setCountdown] = useState('');
  const [err, setErr] = useState('');
  const busy = useRef(false);

  useEffect(() => { if (status) setBalance(status.balance); }, [status]);

  // Live countdown to the next reset (for the cooldown states).
  useEffect(() => {
    const iso = result?.nextResetAt ?? status?.nextResetAt;
    if (!iso) return;
    const tick = () => setCountdown(fmtCountdown(iso));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, result]);

  if (!status) return <div className="page"><div className="skeleton" style={{ height: 320 }} /></div>;

  if (!status.enabled || !status.eligible) {
    return (
      <div className="page spin-screen">
        <h1 className="spin-title">Daily Spin</h1>
        <p className="spin-sub">Reach <b>Basic tier</b> to unlock the daily spin.</p>
        <button className="spin-cta" onClick={() => navigate('/home')}>Back to home</button>
      </div>
    );
  }

  const segs = status.segments;
  const spunToday = phase !== 'done' && !status.canSpin && status.reason === 'spun-today';
  const lowBalance = !status.canSpin && status.reason === 'low-balance';

  const doSpin = async () => {
    if (busy.current || !status.canSpin) return;
    busy.current = true; setErr(''); setPhase('spinning');
    try {
      const r = await apiJson<SpinResult>('/api/spin', { method: 'POST' });
      const centre = r.segmentIndex * 45 + 22.5;               // slice centre, clockwise from top
      const targetMod = (360 - centre + 360) % 360;            // wheel rotation that lands it under the pointer
      const curMod = ((rotation % 360) + 360) % 360;
      const delta = (targetMod - curMod + 360) % 360;
      setRotation(rotation + 360 * 6 + delta);                 // 6 full spins + align
      setResult(r);
      setTimeout(() => { setPhase('done'); setBalance(r.newBalance); refresh(); busy.current = false; }, 4750);
    } catch (e) {
      setErr((e as Error).message); setPhase('idle'); busy.current = false;
    }
  };

  const slabLabel = (pts: number) => (pts >= 1000 ? '1000' : String(pts));

  return (
    <div className="page spin-screen">
      <button className="spin-close" onClick={() => navigate('/home')} aria-label="Close">✕</button>
      <div>
        <h1 className="spin-title">Daily Spin</h1>
        <p className="spin-sub">
          {phase === 'done' ? 'See you tomorrow!' : spunToday ? 'You already spun today' : `Win points · ${status.entryFee} pts to play`}
        </p>
      </div>
      <div className="spin-balchip">🪙 {formatNumber(balance ?? status.balance)} pts</div>

      <div className="spin-stage">
        <div className="spin-ptr" />
        <div className="spin-wheel" style={{ transform: `rotate(${rotation}deg)` }}>
          {segs.map((s, i) => (
            <div key={i} className={`spin-slab${s.points >= 1000 ? ' jack' : i === 3 ? ' mid' : ''}`} style={{ transform: `rotate(${i * 45 + 22.5}deg)` }}>
              <b>{slabLabel(s.points)}</b>
            </div>
          ))}
        </div>
        <div className="spin-spoke" />
        <div className="spin-hub"><div><b>{status.entryFee}</b><small>pts / spin</small></div></div>
      </div>

      {err && <div className="error-banner" role="alert">{err}</div>}

      {phase === 'done' && result ? (
        <div className="spin-result">
          {result.prize > 0
            ? <><div className="amt">+{formatNumber(result.prize)}</div><div>points won! 🎉</div></>
            : <div style={{ fontSize: 20, fontWeight: 800 }}>Better luck tomorrow!</div>}
          <div className="spin-cool" style={{ marginTop: 10 }}>Next spin in <b>{countdown}</b></div>
        </div>
      ) : spunToday ? (
        <div className="spin-cool">
          {status.lastResult != null && status.lastResult > 0 ? <>Today you won <b>+{formatNumber(status.lastResult)}</b>. </> : null}
          Next spin in <b>{countdown}</b>
        </div>
      ) : lowBalance ? (
        <>
          <button className="spin-cta" disabled>Need {status.entryFee} pts to play</button>
          <p className="spin-sub">Earn points on your bills, then come back.</p>
        </>
      ) : (
        <button className="spin-cta" onClick={doSpin} disabled={phase === 'spinning'}>
          {phase === 'spinning' ? 'Spinning…' : `Spin now · −${status.entryFee} pts`}
        </button>
      )}
    </div>
  );
}
