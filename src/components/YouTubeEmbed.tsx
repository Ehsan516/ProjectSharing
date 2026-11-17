"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typings for the YouTube IFrame Player API (no API key needed).
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  destroy(): void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: { onReady?: (e: { target: YTPlayer }) => void };
    },
  ) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return apiPromise;
}

// Only one video plays at a time across the page.
let activePlayer: YTPlayer | null = null;

/**
 * YouTube video that:
 *  - shows a thumbnail until it's near the viewport (cheap feeds),
 *  - autoplays MUTED while it's in the middle of the screen, pauses when scrolled away,
 *  - unmutes when clicked.
 */
export function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const centeredRef = useRef(false);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);

  // Mount the player only when within ~1 screen of the viewport.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Play while the video overlaps the middle band of the screen; pause otherwise.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([entry]) => {
        centeredRef.current = entry.isIntersecting;
        const player = playerRef.current;
        if (!player) return;
        if (entry.isIntersecting && !reduceMotion) play(player);
        else player.pauseVideo();
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Create / destroy the YouTube player.
  useEffect(() => {
    if (!near || !mountRef.current) return;
    let cancelled = false;
    const target = document.createElement("div"); // YT replaces this node with an iframe; keep it out of React's tree
    mountRef.current.appendChild(target);

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(target, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        playerVars: { mute: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: ({ target: player }) => {
            if (cancelled) return;
            player.mute();
            setReady(true);
            setMuted(true);
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (centeredRef.current && !reduceMotion) play(player);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      const player = playerRef.current;
      if (player) {
        if (activePlayer === player) activePlayer = null;
        player.destroy();
      }
      playerRef.current = null;
      setReady(false);
      target.remove();
    };
  }, [near, videoId]);

  function play(player: YTPlayer) {
    if (activePlayer && activePlayer !== player) activePlayer.pauseVideo();
    activePlayer = player;
    player.playVideo();
  }

  function unmute() {
    const player = playerRef.current;
    if (!player) return;
    player.unMute();
    play(player);
    setMuted(false);
  }

  return (
    <div ref={wrapperRef} className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
      {!ready && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      )}
      <div ref={mountRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
      {ready && muted && (
        <button
          type="button"
          onClick={unmute}
          aria-label="Unmute video"
          className="absolute inset-0 flex items-end justify-start p-3"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4-2.7-2.7z" />
            </svg>
            Tap to unmute
          </span>
        </button>
      )}
    </div>
  );
}
