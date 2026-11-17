"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function SearchBox() {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === "/search" ? (params.get("q") ?? "") : "";

  return (
    <form action="/search" className="min-w-0 flex-1" role="search">
      <input
        key={current}
        name="q"
        defaultValue={current}
        placeholder="Search projects — pokemon, fire tv, tesla…"
        className="input rounded-full bg-surface-2"
        aria-label="Search projects"
      />
    </form>
  );
}
