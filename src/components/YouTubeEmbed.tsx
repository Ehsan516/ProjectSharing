"use client";

import { useEffect, useRef, useState } from "react";
import { useVideoConsent } from "@/lib/videoConsent";

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
 *  - shows only a thumbnail until the visitor either taps play or has allowed autoplay,
 *    because loading YouTube can set cookies (UK PECR needs consent first),
 *  - with autoplay allowed: loads near the viewport and plays MUTED while it's in the middle
 *    of the screen, pausing when scrolled away; tap to unmute,
 *  - when tapped: loads and plays straight away, with sound where the browser allows it.
 */
export function YouTubeEmbed({ videoId, title, flush = false }: { videoId: string; title: string; flush?: boolean }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const centeredRef = useRef(false);
  const consent = useVideoConsent();
  const autoplay = consent === "yes";
  const autoplayRef = useRef(autoplay);
  autoplayRef.current = autoplay;
  const [requested, setRequested] = useState(false);
  const requestedRef = useRef(false);
  requestedRef.current = requested;
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const shouldMount = requested || (autoplay && near);

  // Track when we're within ~1 screen of the viewport, to load autoplay players just in time.
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
        if (entry.isIntersecting) {
          if (autoplayRef.current && !reduceMotion) play(player);
        } else {
          player.pauseVideo();
        }
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Create / destroy the YouTube player.
  useEffect(() => {
    if (!shouldMount || !mountRef.current) return;
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
            setReady(true);
            if (requestedRef.current) {
              // The visitor tapped play, so they want sound.
              player.unMute();
              setMuted(false);
              play(player);
              return;
            }
            player.mute();
            setMuted(true);
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (centeredRef.current && autoplayRef.current && !reduceMotion) play(player);
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
  }, [shouldMount, videoId]);

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
    <div
      ref={wrapperRef}
      className={`relative aspect-video w-full overflow-hidden bg-black ${flush ? "" : "rounded-lg"}`}
    >
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
      {!shouldMount && consent !== undefined && (
        <button
          type="button"
          onClick={() => setRequested(true)}
          aria-label={`Play video: ${title}`}
          className="group/play absolute inset-0 grid place-items-center bg-black/10 transition hover:bg-black/25"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-black/70 text-white backdrop-blur transition group-hover/play:scale-105 group-hover/play:bg-signal group-hover/play:text-signal-fg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
        </button>
      )}
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
