"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import type { Profile } from "@/lib/types";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

export function SettingsForm({ profile, welcome, next }: { profile: Profile; welcome: boolean; next: string }) {
  const [state, formAction] = useActionState(updateProfile, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && welcome) router.push(next);
  }, [state, welcome, next, router]);

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-5">
      <div>
        <label htmlFor="username" className="label">
          Username
        </label>
        <div className="flex items-center gap-1">
          <span className="text-muted">@</span>
          <input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={24}
            pattern="[a-z0-9_]{3,24}"
            defaultValue={welcome && profile.username.startsWith("user_") ? "" : profile.username}
            placeholder="your_name"
            className="input"
          />
        </div>
        <p className="hint">Lowercase letters, numbers and underscores.</p>
      </div>
      <div>
        <label htmlFor="display_name" className="label">
          Display name
        </label>
        <input id="display_name" name="display_name" maxLength={60} defaultValue={profile.display_name ?? ""} className="input" />
      </div>
      <div>
        <label htmlFor="bio" className="label">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={300}
          defaultValue={profile.bio ?? ""}
          placeholder="What do you like to build or hack on?"
          className="input"
        />
      </div>
      <FormMessage state={state} />
      {state?.ok && !welcome && <p className="text-sm text-good">Saved.</p>}
      <div className="flex justify-end">
        <SubmitButton>{welcome ? "Continue" : "Save"}</SubmitButton>
      </div>
    </form>
  );
}
