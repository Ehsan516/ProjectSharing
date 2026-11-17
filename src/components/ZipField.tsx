"use client";

import { useState } from "react";
import { MAX_ZIP_BYTES, looksLikeZip } from "@/lib/upload";
import { formatBytes } from "@/lib/utils";

/** File picker that only accepts real .zip files up to 50 MB. */
export function ZipField({
  label = "Files (.zip)",
  onChange,
}: {
  label?: string;
  onChange: (file: File | null, error: string | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);

  async function pick(next: File | undefined) {
    if (!next) {
      setFile(null);
      return onChange(null, null);
    }
    let error: string | null = null;
    if (!next.name.toLowerCase().endsWith(".zip") || !(await looksLikeZip(next))) error = "Only .zip files can be uploaded.";
    else if (next.size > MAX_ZIP_BYTES) error = `Zip must be ${formatBytes(MAX_ZIP_BYTES)} or smaller.`;
    setFile(error ? null : next);
    onChange(error ? null : next, error);
  }

  return (
    <div>
      <label htmlFor="zip_file" className="label">
        {label}
      </label>
      <input
        id="zip_file"
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        onChange={(e) => pick(e.target.files?.[0])}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-text"
      />
      <p className="hint">
        {file
          ? `${file.name} · ${formatBytes(file.size)}`
          : "Up to 50 MB. No ROMs, pirated software or anything you don't have the rights to share."}
      </p>
    </div>
  );
}
