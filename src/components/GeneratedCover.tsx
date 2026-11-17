/** Stable gradient cover for projects without an image, so the grid never looks broken. */
export function GeneratedCover({ seed, title }: { seed: string; title: string }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const hue2 = (hue + 35 + (hash % 50)) % 360;

  return (
    <div
      className="flex h-full w-full items-center justify-center p-6"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${hue2} 75% 42%))` }}
    >
      <span className="line-clamp-2 text-center text-xl font-semibold tracking-tight text-white/95 drop-shadow-sm">
        {title}
      </span>
    </div>
  );
}
