/** The Forkyard mark: a garden fork (three tines) on a signal-orange tile. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="12" fill="var(--signal)" />
      <g fill="var(--signal-fg)">
        <rect x="19" y="11" width="6" height="21" rx="3" />
        <rect x="29" y="11" width="6" height="21" rx="3" />
        <rect x="39" y="11" width="6" height="21" rx="3" />
        <rect x="19" y="27" width="26" height="7" rx="3.5" />
        <rect x="29" y="30" width="6" height="23" rx="3" />
      </g>
    </svg>
  );
}
