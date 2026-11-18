"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function SearchBox() {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === "/search" ? (params.get("q") ?? "") : "";

  return (
    <form action="/search" className="relative min-w-0 flex-1" role="search">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        key={current}
        name="q"
        type="search"
        enterKeyHint="search"
        defaultValue={current}
        placeholder="Search games, devices, tools…"
        className="input border-transparent bg-surface-2 pl-9 focus:border-border-strong focus:bg-surface"
        aria-label="Search projects"
      />
    </form>
  );
}
