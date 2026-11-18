"use client";

import { setVideoConsent, useVideoConsent } from "@/lib/videoConsent";

/** One-time question above a feed that has videos. Disappears once answered. */
export function VideoConsentPrompt() {
  const consent = useVideoConsent();
  if (consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Video previews"
      className="panel col-span-full flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center"
    >
      <p className="min-w-0 flex-1">
        <span className="font-medium">Play video previews automatically?</span>{" "}
        <span className="text-muted">
          Videos come from YouTube, which may set cookies when they play.{" "}
          <a href="/privacy#videos" className="underline hover:text-text">
            Details
          </a>
        </span>
      </p>
      <div className="flex shrink-0 gap-2">
        <button type="button" className="btn-ghost" onClick={() => setVideoConsent("no")}>
          No thanks
        </button>
        <button type="button" className="btn-primary" onClick={() => setVideoConsent("yes")}>
          Allow
        </button>
      </div>
    </div>
  );
}

/** Footer switch so people can change their mind later. */
export function VideoConsentToggle() {
  const consent = useVideoConsent();
  if (consent === undefined) return null;
  const on = consent === "yes";

  return (
    <button
      type="button"
      onClick={() => setVideoConsent(on ? "no" : "yes")}
      className="hover:text-text"
      aria-pressed={on}
    >
      Video autoplay: {on ? "on" : "off"}
    </button>
  );
}
