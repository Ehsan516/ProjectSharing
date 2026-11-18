"use client";

import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Uploads a file straight from the browser to Supabase Storage (not through our server),
 * reporting progress. Storage policies only allow writing into the user's own folder.
 */
export async function uploadWithProgress(
  bucket: "files" | "covers",
  path: string,
  file: File,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const supabase = getBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("You're signed out. Sign in again and retry.");

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Upload failed (${xhr.status})`;
      try {
        message = JSON.parse(xhr.responseText).message ?? message;
      } catch {}
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}

/** True if the file starts with a ZIP signature (PK\x03\x04, or PK\x05\x06 for an empty zip). */
export async function looksLikeZip(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05);
}

export const MAX_ZIP_BYTES = 50 * 1024 * 1024;

/** Uploads a zip into the user's folder; returns the fields the server actions expect. */
export async function uploadZip(file: File, onProgress?: (fraction: number) => void) {
  const {
    data: { user },
  } = await getBrowserClient().auth.getUser();
  if (!user) throw new Error("You're signed out. Sign in again and retry.");
  const path = `${user.id}/${crypto.randomUUID()}.zip`;
  await uploadWithProgress("files", path, file, "application/zip", onProgress);
  return { file_path: path, file_name: file.name };
}
