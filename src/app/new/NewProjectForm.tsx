"use client";

import { useActionState, useState } from "react";
import { createProject } from "@/lib/actions";
import { parseTags } from "@/lib/utils";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

export function NewProjectForm() {
  const [state, formAction] = useActionState(createProject, undefined);
  const [tagsRaw, setTagsRaw] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const tags = parseTags(tagsRaw);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <label htmlFor="title" className="label">
          Title *
        </label>
        <input id="title" name="title" required minLength={3} maxLength={120} className="input" placeholder="Pokémon Emerald save editor" />
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
          className="input"
          placeholder="Edit party, items and money in Emerald and popular romhacks, right in the browser."
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
          placeholder="pokemon, gba, save-editor, romhack"
        />
        <p className="hint">Comma-separated, up to 8. Use the game, device, car or app name so people can find it.</p>
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="link_url" className="label">
            Project link
          </label>
          <input id="link_url" name="link_url" type="url" className="input" placeholder="https://…" />
          <p className="hint">Download, live demo or store page.</p>
        </div>
        <div>
          <label htmlFor="source_url" className="label">
            Source code
          </label>
          <input id="source_url" name="source_url" type="url" className="input" placeholder="https://github.com/…" />
          <p className="hint">Strongly recommended so people can check what it does.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="works_on" className="label">
            Works on
          </label>
          <input id="works_on" name="works_on" maxLength={200} className="input" placeholder="Pokémon Emerald (US), mGBA 0.10" />
          <p className="hint">Device, game version, firmware — whatever you tested on.</p>
        </div>
        <div>
          <label htmlFor="made_with" className="label">
            Made with
          </label>
          <input id="made_with" name="made_with" maxLength={80} className="input" placeholder="Claude Code" />
        </div>
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
          placeholder="What it does, how to install it, known issues…"
        />
      </div>

      <div>
        <label htmlFor="prompt" className="label">
          Recipe (prompt / spec)
        </label>
        <textarea
          id="prompt"
          name="prompt"
          rows={6}
          maxLength={20000}
          className="input font-mono text-xs"
          placeholder="The prompt or spec you gave your AI. Others can paste it into theirs to rebuild this for their own setup."
        />
      </div>

      <div>
        <label htmlFor="cover" className="label">
          Cover image
        </label>
        <input
          id="cover"
          name="cover"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-text"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
        <p className="hint">PNG, JPG, WebP or GIF, up to 5 MB. A screenshot works great.</p>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="mt-2 max-h-48 rounded-lg border border-border object-cover" />
        )}
      </div>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Posting…">Post project</SubmitButton>
      </div>
    </form>
  );
}
