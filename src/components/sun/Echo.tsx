import { useEffect, useState } from 'react';
import { dismissCelebration, useEcho } from '@/app/echo';
import { en } from '@/copy/en';

const RIPPLE_MS = 1500;
const CELEBRATION_MS = 3000;
const RING_COLOURS = ['var(--ll-btn)', 'var(--ll-sage)', 'var(--ll-ink)'];

/**
 * FR-DSN-8: draws the Echo events. Both start at the sun's centre (195, 860 in the 390 × 844 box).
 * Ripple: three thin rings (r 318, stroke 6, button colour) scale 0.82 → 1.5 and fade, 250 ms
 * apart. Celebration: the page dims, six bold rings (stroke 26, button → sage → ink) sweep the
 * screen, a centred message fades in; about 3 s, and a tap ends it early. Each plays once per event.
 */
export function EchoLayer() {
  const ripples = useEcho((s) => s.ripples);
  const celebration = useEcho((s) => s.celebration);
  const [rippling, setRippling] = useState(0);

  useEffect(() => {
    if (!ripples) return;
    setRippling(ripples);
    const t = window.setTimeout(() => setRippling(0), RIPPLE_MS);
    return () => window.clearTimeout(t);
  }, [ripples]);

  useEffect(() => {
    if (!celebration) return;
    const t = window.setTimeout(dismissCelebration, CELEBRATION_MS);
    return () => window.clearTimeout(t);
  }, [celebration?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {rippling > 0 && (
        <div className="sun-backdrop" aria-hidden="true" data-testid="echo-ripple" key={rippling}>
          <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMax meet" focusable="false">
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                className="sun-echo-ring"
                style={{ animationDelay: `${i * 250}ms` }}
                cx="195"
                cy="860"
                r="318"
                fill="none"
                stroke="var(--ll-btn)"
                strokeWidth="6"
              />
            ))}
          </svg>
        </div>
      )}
      {celebration && (
        <button
          type="button"
          className="sun-celebration"
          data-testid="echo-celebration"
          aria-label={en.sun.echo.dismiss}
          onClick={dismissCelebration}
        >
          <span className="sun-celebration-dim" aria-hidden="true" />
          <span className="sun-backdrop !z-0" aria-hidden="true">
            <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMax meet" focusable="false">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <circle
                  key={i}
                  className="sun-celebration-ring"
                  style={{ animationDelay: `${i * 250}ms` }}
                  cx="195"
                  cy="860"
                  r="318"
                  fill="none"
                  stroke={RING_COLOURS[i % 3]}
                  strokeWidth="26"
                />
              ))}
            </svg>
          </span>
          <span className="sun-celebration-msg" aria-hidden="true">
            <span className="sun-display block text-[30px] uppercase">{celebration.title}</span>
            {celebration.lines.map((l) => (
              <span key={l} className="mt-2 block text-[17px] font-semibold">
                {l}
              </span>
            ))}
          </span>
        </button>
      )}
      {/* The message for screen readers, announced once, without the motion. */}
      <div className="sr-only" role="status" aria-live="polite">
        {celebration ? [celebration.title, ...celebration.lines].join('. ') : ''}
      </div>
    </>
  );
}
