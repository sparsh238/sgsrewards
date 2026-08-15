import { useNavigate } from 'react-router-dom';
import { useSpin } from '../lib/spin';

// The "it's ready today" nudge on Home — sits below the tier gauge. Only shows
// when a spin is actually available (eligible tier + not spun today + enough
// points); once used it disappears, so Home stays uncluttered.
export default function SpinHomeCard() {
  const { status } = useSpin();
  const navigate = useNavigate();
  if (!status || !status.enabled || !status.eligible || !status.canSpin) return null;
  return (
    <button className="spin-card" onClick={() => navigate('/spin')}>
      <div className="sc-wheel" />
      <div>
        <div className="sc-k">Your daily spin is ready 🎡</div>
        <div className="sc-s">Spin the wheel · {status.entryFee} pts to play</div>
      </div>
      <span className="sc-go">Spin</span>
    </button>
  );
}
