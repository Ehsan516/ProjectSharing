"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * A <details> menu that behaves like a real dropdown: it closes when you click outside it,
 * press Escape, follow a link inside it, or navigate to another page.
 */
export function Dropdown({
  summary,
  label,
  summaryClassName = "",
  panelClassName = "",
  children,
}: {
  summary: React.ReactNode;
  label?: string;
  summaryClassName?: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    }
    function onKeyDown(e: KeyboardEvent) {
      const el = ref.current;
      if (e.key === "Escape" && el?.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary aria-label={label} className={`cursor-pointer list-none ${summaryClassName}`}>
        {summary}
      </summary>
      <div
        className={`card absolute right-0 z-30 mt-2 shadow-lg ${panelClassName}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a") && ref.current) ref.current.open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}
