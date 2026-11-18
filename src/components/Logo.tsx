/** The Forkyard mark, "Split": one path forking into two, on a signal-orange tile. */
export function LogoMark({ size = 28 }: { size?: number }) {
  // Thicker strokes at small sizes so the mark stays crisp in the header and favicon.
  const stroke = size <= 24 ? 7 : 6;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="14" fill="var(--signal)" />
      <g
        fill="none"
        stroke="var(--signal-fg)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M32 52V36" />
        <path d="M32 36c0-8-11-9-11-18" />
        <path d="M32 36c0-8 11-9 11-18" />
        <path d="M15 23l6-7 6 7" />
        <path d="M37 23l6-7 6 7" />
      </g>
    </svg>
  );
}
