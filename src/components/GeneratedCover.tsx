/**
 * Cover for projects without an image: a flat tile from a small set of workshop colours,
 * with the title set large. Picked from the project id, so it never changes.
 */
const TILES = [
  { bg: "#2f4b7c", fg: "#f8f7f4" },
  { bg: "#3d6b4f", fg: "#f8f7f4" },
  { bg: "#8a3b2e", fg: "#f8f7f4" },
  { bg: "#d9b54a", fg: "#191917" },
  { bg: "#5b4a7a", fg: "#f8f7f4" },
  { bg: "#c9c3b6", fg: "#191917" },
  { bg: "#1f1e1b", fg: "#c4b5ff" },
];

export function GeneratedCover({ seed, title }: { seed: string; title: string }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const tile = TILES[hash % TILES.length];

  return (
    <div className="flex h-full w-full flex-col justify-end p-5" style={{ background: tile.bg, color: tile.fg }}>
      <span className="line-clamp-2 font-display text-2xl font-bold leading-tight tracking-tight">{title}</span>
    </div>
  );
}
