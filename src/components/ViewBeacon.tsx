"use client";

import { useEffect } from "react";

/** Tells the server this project page was viewed, once per page load. See /api/view. */
export function ViewBeacon({ projectId }: { projectId: string }) {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref") ?? "";
    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, referrer: document.referrer, ref }),
      keepalive: true,
    }).catch(() => {});
  }, [projectId]);
  return null;
}
