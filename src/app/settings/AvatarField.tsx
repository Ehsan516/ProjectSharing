"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAvatar } from "@/lib/actions";
import { getBrowserClient } from "@/lib/supabase/client";
import { uploadWithProgress } from "@/lib/upload";
import { Avatar } from "@/components/Avatar";
import type { Author } from "@/lib/types";

const SIZE = 400;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

/** Centre-crops to a square and shrinks to 400x400, so uploads are small and every avatar is the same shape. */
async function toSquareImage(file: File): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process that image.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpg = await encode("image/jpeg"); // Safari before 17 can't encode WebP
  if (!jpg) throw new Error("Your browser couldn't process that image.");
  return { blob: jpg, ext: "jpg" };
}

export function AvatarField({ profile }: { profile: Author }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(profile.avatar_url);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();
  const busy = status !== null || saving;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choose an image file, like a PNG or JPG.");
    if (file.size > MAX_INPUT_BYTES) return setError("That image is over 15 MB. Choose a smaller one.");

    try {
      setStatus("Preparing photo…");
      const { blob, ext } = await toSquareImage(file);
      const {
        data: { user },
      } = await getBrowserClient().auth.getUser();
      if (!user) throw new Error("You're signed out. Sign in again and retry.");

      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      setStatus("Uploading…");
      await uploadWithProgress("avatars", path, new File([blob], `avatar.${ext}`, { type: blob.type }), blob.type);
      setStatus(null);
      startTransition(async () => {
        const result = await updateAvatar(path);
        if (result?.error) return setError(result.error);
        setPreview(URL.createObjectURL(blob));
        router.refresh();
      });
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await updateAvatar(null);
      if (result?.error) return setError(result.error);
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <section className="card flex items-center gap-5 p-5">
      <div className={busy ? "opacity-60" : ""}>
        <Avatar author={{ ...profile, avatar_url: preview }} size={80} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-medium">Profile photo</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`btn-ghost cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {preview ? "Change photo" : "Upload photo"}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
          {preview && (
            <button type="button" onClick={remove} disabled={busy} className="text-sm text-muted hover:text-bad">
              Remove
            </button>
          )}
          {(status || saving) && <span className="text-sm text-muted">{status ?? "Saving…"}</span>}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        ) : (
          <p className="hint !mt-0">Square photos work best. We crop it to a square and shrink it for you.</p>
        )}
      </div>
    </section>
  );
}
