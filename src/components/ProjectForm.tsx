"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { ActionState } from "@/lib/types";
import { getBrowserClient } from "@/lib/supabase/client";
import { uploadWithProgress, uploadZip } from "@/lib/upload";
import { blockEnterSubmit, parseTags, parseYouTubeId } from "@/lib/utils";
import { FormMessage } from "@/components/SubmitButton";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { ZipField } from "@/components/ZipField";

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type ProjectFormValues = {
  authorship: "own" | "shared";
  original_creator: string | null;
  original_url: string | null;
  permission_confirmed: boolean;
  title: string;
  summary: string;
  tags: string[];
  link_url: string | null;
  source_url: string | null;
  youtube_id: string | null;
  works_on: string | null;
  body: string | null;
  cover_url: string | null;
};

/**
 * Post form. "create" also takes the first zip + version;
 * "edit" changes the post itself (files and versions are handled by releases).
 */
export function ProjectForm({
  mode,
  action,
  initial,
  cancelHref,
}: {
  mode: "create" | "edit";
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: ProjectFormValues;
  cancelHref?: string;
}) {
  const editing = mode === "edit";
  const [state, formAction, saving] = useActionState(action, undefined);
  const [, startTransition] = useTransition();
  const [tagsRaw, setTagsRaw] = useState(initial?.tags.join(", ") ?? "");
  const [youtubeRaw, setYoutubeRaw] = useState(initial?.youtube_id ? `https://youtu.be/${initial.youtube_id}` : "");
  const [removeCover, setRemoveCover] = useState(false);
  const [shared, setShared] = useState(initial?.authorship === "shared");
  const [cover, setCover] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // One preview URL per chosen file, released when it changes so previews don't leak memory.
  const coverPreview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const tags = parseTags(tagsRaw);
  const youtubeId = parseYouTubeId(youtubeRaw);
  const busy = progress !== null || saving;

  function onCoverChange(file: File | undefined) {
    setLocalError(null);
    if (!file) return setCover(null);
    if (!COVER_TYPES[file.type]) {
      setCover(null);
      return setLocalError("Cover image must be PNG, JPG, WebP or GIF.");
    }
    if (file.size > MAX_COVER_BYTES) {
      setCover(null);
      return setLocalError("Cover image must be 5 MB or smaller.");
    }
    setCover(file);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setLocalError(null);
    const formData = new FormData(e.currentTarget);
    formData.delete("cover_file");

    try {
      const {
        data: { user },
      } = await getBrowserClient().auth.getUser();
      if (!user) throw new Error("You're signed out. Sign in again and retry.");

      if (cover) {
        const path = `${user.id}/${crypto.randomUUID()}.${COVER_TYPES[cover.type]}`;
        setProgress("Uploading cover image…");
        await uploadWithProgress("covers", path, cover, cover.type);
        formData.set("cover_path", path);
      }
      if (zip) {
        const uploaded = await uploadZip(zip, (f) => setProgress(`Uploading zip… ${Math.round(f * 100)}%`));
        formData.set("file_path", uploaded.file_path);
        formData.set("file_name", uploaded.file_name);
      }
    } catch (err) {
      setProgress(null);
      return setLocalError(err instanceof Error ? err.message : "Upload failed.");
    }

    setProgress(null);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} onKeyDown={blockEnterSubmit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="label">Who made this? *</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm ${!shared ? "border-text bg-surface" : "border-border"}`}
          >
            <input
              type="radio"
              name="authorship"
              value="own"
              checked={!shared}
              onChange={() => setShared(false)}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              <span className="font-medium">I made this</span>
              <span className="block text-xs text-muted">It&apos;s my own work, or my own changes to something.</span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm ${shared ? "border-text bg-surface" : "border-border"}`}
          >
            <input
              type="radio"
              name="authorship"
              value="shared"
              checked={shared}
              onChange={() => setShared(true)}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              <span className="font-medium">Sharing someone else&apos;s work</span>
              <span className="block text-xs text-muted">They made it and said you can post it here.</span>
            </span>
          </label>
        </div>

        {shared && (
          <div className="panel flex flex-col gap-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="original_creator" className="label">
                  Made by *
                </label>
                <input
                  id="original_creator"
                  name="original_creator"
                  required
                  maxLength={80}
                  defaultValue={initial?.original_creator ?? ""}
                  className="input"
                  placeholder="Their name or username"
                />
              </div>
              <div>
                <label htmlFor="original_url" className="label">
                  Original link *
                </label>
                <input
                  id="original_url"
                  name="original_url"
                  type="url"
                  required
                  defaultValue={initial?.original_url ?? ""}
                  className="input"
                  placeholder="https://…"
                />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="permission_confirmed"
                required
                defaultChecked={initial?.permission_confirmed ?? false}
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span>
                The creator has said I can share this here. Posting someone&apos;s work without permission gets it
                taken down and counts as a strike against your account.
              </span>
            </label>
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor="title" className="label">
          Title *
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={3}
          maxLength={120}
          defaultValue={initial?.title}
          className="input"
          placeholder="Name of your project"
        />
      </div>

      <div>
        <label htmlFor="summary" className="label">
          One-line summary *
        </label>
        <input
          id="summary"
          name="summary"
          required
          maxLength={280}
          defaultValue={initial?.summary}
          className="input"
          placeholder="What does it do, in one sentence?"
        />
      </div>

      <div>
        <label htmlFor="tags" className="label">
          Tags *
        </label>
        <input
          id="tags"
          name="tags"
          required
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          className="input"
          placeholder="e.g. game, device, app, platform"
        />
        <p className="hint">
          Comma-separated, up to 8. Name the game, device or app it&apos;s for so people can find it.
        </p>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded border border-border bg-surface px-1.5 py-px font-mono text-[11px] text-text">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {!editing && (
        <div className="grid gap-5 sm:grid-cols-[1fr_160px]">
          <ZipField
            onChange={(file, error) => {
              setZip(file);
              setLocalError(error);
            }}
          />
          <div>
            <label htmlFor="version" className="label">
              Version
            </label>
            <input id="version" name="version" maxLength={40} className="input" placeholder="1.0" />
            <p className="hint">You can publish updates later.</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="link_url" className="label">
            Project link
          </label>
          <input
            id="link_url"
            name="link_url"
            type="url"
            defaultValue={initial?.link_url ?? ""}
            className="input"
            placeholder="https://…"
          />
          <p className="hint">Website, demo or store page.</p>
        </div>
        <div>
          <label htmlFor="source_url" className="label">
            Source code
          </label>
          <input
            id="source_url"
            name="source_url"
            type="url"
            defaultValue={initial?.source_url ?? ""}
            className="input"
            placeholder="https://…"
          />
          <p className="hint">Recommended so people can check what it does.</p>
        </div>
      </div>

      <div>
        <label htmlFor="youtube_url" className="label">
          YouTube video
        </label>
        <input
          id="youtube_url"
          name="youtube_url"
          value={youtubeRaw}
          onChange={(e) => setYoutubeRaw(e.target.value)}
          className="input"
          placeholder="https://youtube.com/watch?v=…"
        />
        {youtubeRaw.trim() && !youtubeId && (
          <p className="hint text-bad">That doesn&apos;t look like a YouTube video link.</p>
        )}
        {youtubeId && (
          <div className="mt-2 max-w-sm">
            <YouTubeEmbed videoId={youtubeId} title="Video preview" />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="works_on" className="label">
          Works on
        </label>
        <input
          id="works_on"
          name="works_on"
          maxLength={200}
          defaultValue={initial?.works_on ?? ""}
          className="input"
          placeholder="Device, version, OS…"
        />
        <p className="hint">Whatever you tested it on.</p>
      </div>

      <div>
        <label htmlFor="body" className="label">
          Details
        </label>
        <textarea
          id="body"
          name="body"
          rows={6}
          maxLength={20000}
          defaultValue={initial?.body ?? ""}
          className="input"
          placeholder="What it does, how to install or use it, known issues…"
        />
      </div>

      <div>
        <label htmlFor="cover_file" className="label">
          Cover image
        </label>
        <input
          id="cover_file"
          name="cover_file"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => onCoverChange(e.target.files?.[0])}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-text"
        />
        <p className="hint">
          PNG, JPG, WebP or GIF, up to 5 MB. Shown when there&apos;s no video.
          {editing && initial?.cover_url && " Choosing a new image replaces the current one."}
        </p>
        {editing && initial?.cover_url && !cover && (
          <div className="mt-2 flex items-end gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={initial.cover_url}
              alt="Current cover"
              className={`max-h-32 rounded-lg object-cover ${removeCover ? "opacity-30" : ""}`}
            />
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="remove_cover"
                checked={removeCover}
                onChange={(e) => setRemoveCover(e.target.checked)}
              />
              Remove cover
            </label>
          </div>
        )}
        {coverPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverPreview}
            alt=""
            className="mt-2 max-h-48 rounded-lg border border-border object-cover"
          />
        )}
      </div>

      <FormMessage state={localError ? { error: localError } : state} />
      <div className="flex items-center justify-end gap-3">
        {progress && <span className="text-sm text-muted">{progress}</span>}
        {cancelHref && (
          <Link href={cancelHref} className="btn-ghost">
            Cancel
          </Link>
        )}
        <button type="submit" disabled={busy} className="btn-primary">
          {saving
            ? editing
              ? "Saving…"
              : "Posting…"
            : progress
              ? "Uploading…"
              : editing
                ? "Save changes"
                : "Post project"}
        </button>
      </div>
    </form>
  );
}
