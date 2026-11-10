import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from './Icon';
import { en } from '@/copy/en';
import { useDesign } from '@/app/design';

/** Back button + display title + optional mono subtitle (S06, S07, S14 headers). */
export function ScreenHeader({
  title,
  subtitle,
  backTo,
  onBack,
  right,
  size = 34,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  right?: ReactNode;
  size?: number;
}) {
  const navigate = useNavigate();
  const sun = useDesign() === 'sun';
  const back = () => {
    if (onBack) return onBack();
    if (backTo) return navigate(backTo);
    navigate(-1);
  };
  // Rising Sun sub-screen header (handoff mockups): a glass bar with a centred 17 px title.
  if (sun)
    return (
      <header className="sun-bar sun-glass">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center justify-self-start rounded-full text-ink"
          aria-label={en.common.back}
          onClick={back}
        >
          <Icon name="back" />
        </button>
        <div className="min-w-0 text-center">
          <h1 className="break-words text-[17px] font-bold leading-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink2">{subtitle}</p>}
        </div>
        <div className="flex justify-end">{right}</div>
      </header>
    );
  return (
    <header className="flex items-center gap-3 px-5 pt-4">
      <button type="button" className="ll-icon-btn" aria-label={en.common.back} onClick={back}>
        <Icon name="back" />
      </button>
      <div className="min-w-0 grow">
        <h1 className="t-display break-words" style={{ fontSize: size }}>
          {title}
        </h1>
        {subtitle && <p className="t-label mt-1">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function SectionLabel({
  children,
  right,
  className = '',
}: {
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between px-5 pb-1.5 pt-3 ${className}`}>
      <h2 className="t-label">{children}</h2>
      {right && <span className="t-label">{right}</span>}
    </div>
  );
}
