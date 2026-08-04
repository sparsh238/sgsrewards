import logo from '../assets/logo.svg';

// Logo + brand wordmark + screen title, shared across auth screens.
export default function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <img className="auth-logo" src={logo} alt="" aria-hidden="true" />
      <div className="auth-head">
        <div className="brand-wordmark">SGS Rewards</div>
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
      </div>
    </>
  );
}
