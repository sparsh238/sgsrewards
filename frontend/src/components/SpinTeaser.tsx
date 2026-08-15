import { useLocation, useNavigate } from 'react-router-dom';
import { useSpin } from '../lib/spin';

// Always-on entry to the daily spin — a floating wheel, bottom-right, above the
// nav. Hidden for No-Tier / when disabled, and on the spin screen itself. Shows
// a "ready" badge, or a dimmed "Tomorrow" once today's spin is used.
export default function SpinTeaser() {
  const { status } = useSpin();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!status || !status.enabled || !status.eligible || pathname === '/spin') return null;
  const ready = status.canSpin;
  // Outer strip is a frame-width, centred fixed band (like the bottom nav) so the
  // button anchors to the app frame's right edge, not the whole viewport.
  return (
    <div className="spin-fab-strip">
      <button className={`spin-fab${ready ? '' : ' used'}`} onClick={() => navigate('/spin')}
        aria-label={ready ? 'Daily spin — ready' : 'Daily spin — come back tomorrow'}>
        <div className="sf-disc"><span className="sf-badge">{ready ? '1' : '⏱'}</span></div>
        <div className="sf-lab">{ready ? 'Spin' : 'Tomorrow'}</div>
      </button>
    </div>
  );
}
