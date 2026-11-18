"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon } from "@/components/Icons";
import { MenuSwitch } from "@/components/MenuSwitch";

const KEY = "forkyard-theme";
const EVENT = "forkyard-theme-change";

function read(): boolean {
  return document.documentElement.dataset.theme === "dark";
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** Footer switch for the opt-in dark theme. Light (warm paper) is the default. */
export function ThemeToggle({ variant = "footer" }: { variant?: "footer" | "menu" }) {
  const dark = useSyncExternalStore<boolean | undefined>(subscribe, read, () => undefined);
  if (dark === undefined) return null;

  function toggle() {
    const next = !dark;
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      if (next) localStorage.setItem(KEY, "dark");
      else localStorage.removeItem(KEY);
    } catch {
      // Storage blocked; the choice lasts for this page only.
    }
    window.dispatchEvent(new Event(EVENT));
  }

  if (variant === "menu") return <MenuSwitch icon={<MoonIcon />} label="Dark mode" on={dark} onToggle={toggle} />;

  return (
    <button type="button" onClick={toggle} className="hover:text-text" aria-pressed={dark}>
      Dark mode: {dark ? "on" : "off"}
    </button>
  );
}
