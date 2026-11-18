"use client";

import { useState } from "react";
import { ShareIcon } from "@/components/Icons";

/** Opens the phone's share sheet where available, otherwise copies the page link. */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return; // user closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button type="button" onClick={share} className="link-action" aria-live="polite">
      <ShareIcon size={15} />
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
