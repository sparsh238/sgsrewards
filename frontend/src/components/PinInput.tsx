import { useRef, type ChangeEvent, type KeyboardEvent } from 'react';

interface Props {
  value: string;              // up to 4 digits
  onChange: (v: string) => void;
  autoFocus?: boolean;
  ariaLabel?: string;
}

// Four single-digit boxes with auto-advance. Numeric only.
export default function PinInput({ value, onChange, autoFocus, ariaLabel = 'PIN' }: Props) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const setAt = (i: number, digit: string) => {
    const chars = value.split('');
    chars[i] = digit;
    onChange(chars.join('').slice(0, 4));
  };

  const handleChange = (i: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    setAt(i, digit);
    if (i < 3) refs[i + 1].current?.focus();
  };

  const handleKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) {
        setAt(i, '');
      } else if (i > 0) {
        refs[i - 1].current?.focus();
        setAt(i - 1, '');
      }
    }
  };

  return (
    <div className="pin-input" role="group" aria-label={ariaLabel}>
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={refs[i]}
          className="pin-box num"
          inputMode="numeric"
          type="tel"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          value={value[i] ?? ''}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          aria-label={`${ariaLabel} digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
