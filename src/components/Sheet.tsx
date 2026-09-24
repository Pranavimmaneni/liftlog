import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { en } from '@/copy/en';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet (S20/S23/S24/S25, confirmations S26): modal dialog with focus trap,
 * Escape to close, a labelled close button, and focus returned to the opener.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  tone = 'default',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'danger';
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = panel.current;
    const focusables = () =>
      el ? [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => !x.hasAttribute('disabled')) : [];
    const first = focusables();
    (first[1] ?? first[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const a = f[0]!;
        const z = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-shadow/45" aria-hidden="true" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        className={`ll-sheet-anim relative max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[10px] border-t-2 bg-paper px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 ${
          tone === 'danger' ? 'border-accent' : 'border-ink'
        }`}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded bg-rule" aria-hidden="true" />
        <div className="flex items-start gap-3">
          <h2 id={`${id}-t`} className="t-display grow pt-2 text-[28px]">
            {title}
          </h2>
          <button type="button" className="ll-icon-btn" aria-label={en.common.close} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
        {footer && <div className="mt-4 flex flex-col gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
