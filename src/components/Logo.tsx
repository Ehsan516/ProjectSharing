/**
 * Forkyard's logo system:
 *  - Wordmark: "forkyard" in the heading font with a lilac full stop. Used in the header.
 *  - Monogram: "fy" on a lilac tile. Used where there's only room for a square (favicon, app icon,
 *    see src/app/icon.svg and apple-icon.png).
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-[22px] font-extrabold leading-none tracking-[-0.03em] ${className}`}>
      forkyard
      <span aria-hidden className="ml-[2px] inline-block h-[6px] w-[6px] rounded-[1.5px] bg-accent align-baseline" />
    </span>
  );
}
