import type { Author } from "@/lib/types";

export function Avatar({ author, size = 24 }: { author: Author | null; size?: number }) {
  const label = author?.display_name || author?.username || "?";
  if (author?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.avatar_url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold uppercase text-accent"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {label[0]}
    </span>
  );
}
