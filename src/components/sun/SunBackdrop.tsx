/**
 * FR-DSN-3: the rising sun (handoff §5). One SVG fixed behind the content: a disc and two rings
 * centred at (195, 860) in a 390 × 844 box, so about the top third of the disc shows above the
 * bottom edge. It scales with the viewport width, stays anchored to the bottom and never scrolls.
 * A faint grain overlays it (dropped when glass is switched off, handoff §8.6).
 */
export function SunBackdrop() {
  return (
    <div className="sun-backdrop" aria-hidden="true" data-testid="sun-backdrop">
      <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMax meet" focusable="false">
        <defs>
          <filter id="sun-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 0.9" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
        <circle cx="195" cy="860" r="325" fill="none" stroke="var(--ll-sunRingThin)" strokeWidth="14" />
        <circle cx="195" cy="860" r="284" fill="none" stroke="var(--ll-sunRingWide)" strokeWidth="44" />
        <circle cx="195" cy="860" r="250" fill="var(--ll-sunDisc)" />
        <rect
          className="sun-grain"
          width="390"
          height="844"
          fill="var(--ll-paper)"
          filter="url(#sun-grain)"
          opacity=".35"
        />
      </svg>
    </div>
  );
}
