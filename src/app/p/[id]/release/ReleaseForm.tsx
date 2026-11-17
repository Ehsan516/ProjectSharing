"use client";

import { useActionState, useState, useTransition } from "react";
import type { ActionState } from "@/lib/types";
import { uploadZip } from "@/lib/upload";
import { FormMessage } from "@/components/SubmitButton";
import { ZipField } from "@/components/ZipField";

export function ReleaseForm({
  action,
  suggestedVersion,
  defaultWorksOn,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  suggestedVersion: string;
  defaultWorksOn: string;
}) {
  const [state, formAction, saving] = useActionState(action, undefined);
  const [, startTransition] = useTransition();
  const [zip, setZip] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const busy = progress !== null || saving;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setLocalError(null);
    const formData = new FormData(e.currentTarget);
    if (zip) {
      try {
        const uploaded = await uploadZip(zip, (f) => setProgress(`Uploading zip… ${Math.round(f * 100)}%`));
        formData.set("file_path", uploaded.file_path);
        formData.set("file_name", uploaded.file_name);
      } catch (err) {
        setProgress(null);
        return setLocalError(err instanceof Error ? err.message : "Upload failed.");
      }
    }
    setProgress(null);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
        <div>
          <label htmlFor="version" className="label">
            Version *
          </label>
          <input id="version" name="version" required maxLength={40} defaultValue={suggestedVersion} className="input" placeholder="1.1" />
        </div>
        <div>
          <label htmlFor="works_on" className="label">
            Works on
          </label>
          <input
            id="works_on"
            name="works_on"
            maxLength={200}
            defaultValue={defaultWorksOn}
            className="input"
            placeholder="Device, version, OS…"
          />
          <p className="hint">What you tested this version on.</p>
        </div>
      </div>

      <div>
        <label htmlFor="changelog" className="label">
          What changed?
        </label>
        <textarea
          id="changelog"
          name="changelog"
          rows={6}
          maxLength={10000}
          className="input"
          placeholder={"- Fixed …\n- Added …\n- Now works on …"}
        />
      </div>

      <ZipField
        label="Updated files (.zip)"
        onChange={(file, error) => {
          setZip(file);
          setLocalError(error);
        }}
      />

      <FormMessage state={localError ? { error: localError } : state} />
      <div className="flex items-center justify-end gap-3">
        {progress && <span className="text-sm text-muted">{progress}</span>}
        <button type="submit" disabled={busy} className="btn-primary">
          {saving ? "Publishing…" : progress ? "Uploading…" : "Publish update"}
        </button>
      </div>
    </form>
  );
}
