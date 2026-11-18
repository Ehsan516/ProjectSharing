"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIEW = 280; // on-screen crop area, px
const OUT = 400; // saved photo, px

type Source = { el: HTMLImageElement; w: number; h: number };

/**
 * Lets people position their photo inside the circle before it's saved:
 * drag to move, slider or scroll wheel to zoom, buttons and a slider to rotate, arrow keys to nudge.
 */
export function AvatarCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob, ext: "webp" | "jpg") => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<Source | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // degrees
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // in VIEW pixels
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  // Load the picked file into an <img> (handles EXIF orientation in modern browsers).
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setSrc({ el: img, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setLoadError("Your browser can't open that image. Try a JPG or PNG.");
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      if (!src) return;
      const k = size / VIEW;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "#e4e1da";
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2 + offset.x * k, size / 2 + offset.y * k);
      ctx.rotate((rotation * Math.PI) / 180);
      const scale = (size / Math.min(src.w, src.h)) * zoom; // zoom 1 = the short side fills the circle
      ctx.drawImage(src.el, (-src.w * scale) / 2, (-src.h * scale) / 2, src.w * scale, src.h * scale);
      ctx.restore();
    },
    [src, zoom, rotation, offset],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = VIEW * dpr;
    canvas.height = VIEW * dpr;
    draw(ctx, VIEW * dpr);
  }, [draw]);

  // Wheel zoom without scrolling the page.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 1, 5));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  async function confirm() {
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    draw(ctx, OUT);
    const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
    const webp = await encode("image/webp");
    if (webp && webp.type === "image/webp") return onConfirm(webp, "webp");
    const jpg = await encode("image/jpeg"); // older Safari can't encode WebP
    if (jpg) onConfirm(jpg, "jpg");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 20 : 4;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setOffset((o) => ({ x: o.x + m[0], y: o.y + m[1] }));
    } else if (e.key === "+" || e.key === "=") setZoom((z) => clamp(z * 1.1, 1, 5));
    else if (e.key === "-") setZoom((z) => clamp(z / 1.1, 1, 5));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="card w-full max-w-sm p-5 shadow-xl">
        <h2 id="crop-title" className="text-lg font-bold">
          Position your photo
        </h2>
        <p className="mt-0.5 text-xs text-muted">Drag to move. Scroll or use the slider to zoom.</p>

        <div className="relative mx-auto mt-4 overflow-hidden rounded-md bg-surface-2" style={{ width: VIEW, height: VIEW }}>
          {loadError ? (
            <p className="grid h-full place-items-center p-6 text-center text-sm text-bad">{loadError}</p>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                tabIndex={0}
                aria-label="Photo position. Use arrow keys to move, plus and minus to zoom."
                onKeyDown={onKeyDown}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
                }}
                onPointerMove={(e) => {
                  const d = drag.current;
                  if (!d || d.id !== e.pointerId) return;
                  setOffset((o) => ({ x: o.x + e.clientX - d.x, y: o.y + e.clientY - d.y }));
                  drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
                }}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
                style={{ width: VIEW, height: VIEW }}
              />
              {/* Dims everything outside the circle, so you see exactly what will show. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ boxShadow: "0 0 0 999px rgba(20,19,17,0.55)", outline: "2px solid rgba(255,255,255,0.8)" }}
              />
            </>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm">
          <label className="flex items-center gap-3">
            <span className="w-14 text-muted">Zoom</span>
            <input
              type="range"
              min={1}
              max={5}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[var(--signal)]"
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-14 text-muted">Rotate</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="flex-1 accent-[var(--signal)]"
            />
            <span className="w-9 text-right font-mono text-xs text-muted">{Math.round(rotation)}°</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setRotation((r) => wrap(r - 90))}>
              ⟲ 90°
            </button>
            <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setRotation((r) => wrap(r + 90))}>
              ⟳ 90°
            </button>
            <button
              type="button"
              className="ml-auto text-xs text-muted hover:text-text"
              onClick={() => {
                setZoom(1);
                setRotation(0);
                setOffset({ x: 0, y: 0 });
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={confirm} disabled={!src}>
            Save photo
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Keeps rotation within -180..180 so the slider stays in range. */
function wrap(deg: number) {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}
