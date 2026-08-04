import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

// Header for pushed screens (Product, Buy now, Order detail…). Tab roots don't
// use this — the bottom nav is their navigation.
interface Props {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
  fallback?: string; // where to go if there is no history to pop
}

export default function AppBar({ title, right, onBack, fallback }: Props) {
  const navigate = useNavigate();
  const back = onBack ?? (() => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallback ?? '/home');
  });
  return (
    <div className="appbar">
      <button className="appbar-back" aria-label="Back" onClick={back}>‹</button>
      <span className="appbar-title">{title}</span>
      {right != null && <span className="appbar-right">{right}</span>}
    </div>
  );
}
