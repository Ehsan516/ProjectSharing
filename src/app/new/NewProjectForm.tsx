"use client";

import { useActionState, useState, useTransition } from "react";
import { createProject } from "@/lib/actions";
import { getBrowserClient } from "@/lib/supabase/client";
import { looksLikeZip, uploadWithProgress } from "@/lib/upload";
import { formatBytes, parseTags, parseYouTubeId } from "@/lib/utils";
import { FormMessage } from "@/components/SubmitButton";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";

const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function NewProjectForm() {
  const [state, formAction, saving] = useActionState(createProject, undefined);
  const [, startTransition] = useTransition();
  const [tagsRaw, setTagsRaw] = useState("");
  const [youtubeRaw, setYoutubeRaw] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const tags = parseTags(tagsRaw);
  const youtubeId = parseYouTubeId(youtubeRaw);
  const busy = progress !== null || saving;

  async function onZipChange(file: File | undefined) {
    setLocalError(null);
    if (!file) return setZip(null);
    if (!file.name.toLowerCase().endsWith(".zip") || !(await looksLikeZip(file))) {
      setZip(null);
      return setLocalError("Only .zip files can be uploaded.");
    }
    if (file.size > MAX_ZIP_BYTES) {
      setZip(null);
      return setLocalError(`Zip must be ${formatBytes(MAX_ZIP_BYTES)} or smaller.`);
    }
    setZip(file);
  }

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
    formData.delete("zip_file");

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
        const path = `${user.id}/${crypto.randomUUID()}.zip`;
        await uploadWithProgress("files", path, zip, "application/zip", (f) =>
          setProgress(`Uploading zip… ${Math.round(f * 100)}%`),
        );
        formData.set("file_path", path);
        formData.set("file_name", zip.name);
      }
    } catch (err) {
      setProgress(null);
      return setLocalError(err instanceof Error ? err.message : "Upload failed.");
    }

    setProgress(null);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <label htmlFor="title" className="label">
          Title *
        </label>
        <input id="title" name="title" required minLength={3} maxLength={120} className="input" placeholder="Name of your project" />
      </div>

      <div>
        <label htmlFor="summary" className="label">
          One-line summary *
        </label>
        <input id="summary" name="summary" required maxLength={280} className="input" placeholder="What does it do, in one sentence?" />
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
        <p className="hint">Comma-separated, up to 8. Name the game, device or app it&apos;s for so people can find it.</p>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="zip_file" className="label">
          Files (.zip)
        </label>
        <input
          id="zip_file"
          name="zip_file"
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={(e) => onZipChange(e.target.files?.[0])}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-text"
        />
        <p className="hint">
          {zip ? `${zip.name} · ${formatBytes(zip.size)}` : "Up to 50 MB. No ROMs, pirated software or anything you don't have the rights to share."}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="link_url" className="label">
            Project link
          </label>
          <input id="link_url" name="link_url" type="url" className="input" placeholder="https://…" />
          <p className="hint">Website, demo or store page.</p>
        </div>
        <div>
          <label htmlFor="source_url" className="label">
            Source code
          </label>
          <input id="source_url" name="source_url" type="url" className="input" placeholder="https://…" />
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
        {youtubeRaw.trim() && !youtubeId && <p className="hint text-bad">That doesn&apos;t look like a YouTube video link.</p>}
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
        <input id="works_on" name="works_on" maxLength={200} className="input" placeholder="Device, version, OS…" />
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
        <p className="hint">PNG, JPG, WebP or GIF, up to 5 MB. Shown when there&apos;s no video.</p>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={URL.createObjectURL(cover)} alt="" className="mt-2 max-h-48 rounded-lg border border-border object-cover" />
        )}
      </div>

      <FormMessage state={localError ? { error: localError } : state} />
      <div className="flex items-center justify-end gap-3">
        {progress && <span className="text-sm text-muted">{progress}</span>}
        <button type="submit" disabled={busy} className="btn-primary">
          {saving ? "Posting…" : progress ? "Uploading…" : "Post project"}
        </button>
      </div>
    </form>
  );
}
