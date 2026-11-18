"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the visitor allowed feed videos to load and play automatically.
 * Autoplay means YouTube loads without a tap, which can set cookies, so UK law (PECR) needs a yes first.
 * Stored on the device only. "yes" | "no" | null (not asked yet).
 */
export type VideoConsent = "yes" | "no" | null;

const KEY = "forkyard-video-autoplay";
const EVENT = "forkyard-video-consent";

function read(): VideoConsent {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "yes" || v === "no" ? v : null;
  } catch {
    return null;
  }
}

export function setVideoConsent(value: VideoConsent) {
  try {
    if (value) window.localStorage.setItem(KEY, value);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Returns undefined during server render / before hydration, so nothing flashes. */
export function useVideoConsent(): VideoConsent | undefined {
  return useSyncExternalStore<VideoConsent | undefined>(subscribe, read, () => undefined);
}
