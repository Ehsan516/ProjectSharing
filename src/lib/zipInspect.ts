import { createHash } from "node:crypto";
import type { ZipEntryInfo, ZipManifest } from "@/lib/types";

const EOCD_SIG = 0x06054b50;
const ZIP64_LOCATOR_SIG = 0x07064b50;
const ZIP64_EOCD_SIG = 0x06064b50;
const CD_SIG = 0x02014b50;

const MAX_FILES = 10_000;
const MAX_STORED_ENTRIES = 200;
const MAX_UNCOMPRESSED_BYTES = 1_073_741_824; // 1 GiB
const SUSPICIOUS_RATIO_MIN_BYTES = 50 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;

const FORBIDDEN_ROM_EXTS = new Set([
  ".nsp",
  ".xci",
  ".cia",
  ".3ds",
  ".nds",
  ".gba",
  ".gbc",
  ".gb",
  ".nes",
  ".sfc",
  ".smc",
  ".n64",
  ".z64",
  ".v64",
  ".gcm",
  ".wbfs",
  ".rvz",
  ".iso",
  ".chd",
  ".pbp",
]);

const EXECUTABLE_EXTS = new Set([
  ".exe",
  ".dll",
  ".msi",
  ".bat",
  ".cmd",
  ".ps1",
  ".vbs",
  ".scr",
  ".com",
  ".sh",
  ".dmg",
  ".pkg",
  ".appimage",
  ".apk",
  ".so",
  ".dylib",
]);

function fileExtension(normalizedPath: string): string {
  const base = normalizedPath.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

function hasUnsafePath(rawName: string): boolean {
  if (!rawName || rawName.includes("\0")) return true;
  const normalized = rawName.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return true;
  return normalized.split("/").some((segment) => segment === "..");
}

function readUInt64Number(buf: Buffer, offset: number): number {
  const val = buf.readBigUInt64LE(offset);
  return val > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(val);
}

/**
 * Inspects a `.zip` archive's Central Directory without decompressing any payload bytes.
 * Computes SHA-256, checks Zip-Slip paths, zip bombs, forbidden ROM/disc images,
 * and flags executable binaries in `manifest.warnings`.
 */
export function inspectZipBuffer(
  buf: Buffer,
): { ok: true; sha256: string; manifest: ZipManifest } | { ok: false; error: string } {
  const sha256 = createHash("sha256").update(buf).digest("hex");

  if (buf.length < 22) {
    return { ok: false, error: "That file isn't a valid .zip archive." };
  }

  const minOffset = Math.max(0, buf.length - 65557);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      const commentLen = buf.readUInt16LE(i + 20);
      if (i + 22 + commentLen === buf.length) {
        eocdOffset = i;
        break;
      }
    }
  }

  if (eocdOffset === -1) {
    return { ok: false, error: "That file isn't a valid .zip archive." };
  }

  const diskNum = buf.readUInt16LE(eocdOffset + 4);
  const cdDisk = buf.readUInt16LE(eocdOffset + 6);
  if (diskNum !== 0 || cdDisk !== 0) {
    return { ok: false, error: "Multi-disk .zip archives aren't supported." };
  }

  let entryCount = buf.readUInt16LE(eocdOffset + 10);
  let cdSize = buf.readUInt32LE(eocdOffset + 12);
  let cdOffset = buf.readUInt32LE(eocdOffset + 16);

  // Support ZIP64 End of Central Directory when present.
  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const locOffset = eocdOffset - 20;
    if (locOffset < 0 || buf.readUInt32LE(locOffset) !== ZIP64_LOCATOR_SIG) {
      return { ok: false, error: "That file isn't a valid .zip archive." };
    }
    const zip64EocdOffset = readUInt64Number(buf, locOffset + 8);
    if (zip64EocdOffset + 56 > buf.length || buf.readUInt32LE(zip64EocdOffset) !== ZIP64_EOCD_SIG) {
      return { ok: false, error: "That file isn't a valid .zip archive." };
    }
    entryCount = readUInt64Number(buf, zip64EocdOffset + 32);
    cdSize = readUInt64Number(buf, zip64EocdOffset + 40);
    cdOffset = readUInt64Number(buf, zip64EocdOffset + 48);
  }

  if (entryCount > MAX_FILES) {
    return { ok: false, error: `Archives can contain at most ${MAX_FILES.toLocaleString()} entries.` };
  }

  if (entryCount === 0) {
    return {
      ok: true,
      sha256,
      manifest: { file_count: 0, total_uncompressed: 0, entries: [], warnings: [] },
    };
  }

  if (cdOffset + cdSize > buf.length || cdOffset >= eocdOffset) {
    return { ok: false, error: "That .zip archive appears corrupted." };
  }

  let cursor = cdOffset;
  const cdEnd = cdOffset + cdSize;
  let totalUncompressed = 0;
  let fileCount = 0;
  const entries: ZipEntryInfo[] = [];
  const warningSet = new Set<string>();

  for (let i = 0; i < entryCount; i++) {
    if (cursor + 46 > cdEnd || cursor + 46 > buf.length || buf.readUInt32LE(cursor) !== CD_SIG) {
      return { ok: false, error: "That .zip archive has corrupted file headers." };
    }

    const flags = buf.readUInt16LE(cursor + 8);
    const uncompressed32 = buf.readUInt32LE(cursor + 24);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);

    const recordLen = 46 + nameLen + extraLen + commentLen;
    if (cursor + recordLen > cdEnd || cursor + recordLen > buf.length) {
      return { ok: false, error: "That .zip archive has truncated file headers." };
    }

    const encoding = (flags & 0x0800) !== 0 ? "utf8" : "latin1";
    const rawName = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString(encoding);

    if (hasUnsafePath(rawName)) {
      return { ok: false, error: "That .zip contains unsafe file paths (such as '..' or leading slashes)." };
    }

    if (uncompressed32 === 0xffffffff) {
      return { ok: false, error: "That .zip archive expands too large (over 1 GB limit)." };
    }

    const normalized = rawName.replace(/\\/g, "/");
    const isDir = normalized.endsWith("/");

    if (!isDir) {
      fileCount += 1;
      totalUncompressed += uncompressed32;

      if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
        return { ok: false, error: "Uncompressed archive size exceeds the 1 GB safety limit." };
      }

      const ext = fileExtension(normalized);
      if (FORBIDDEN_ROM_EXTS.has(ext)) {
        return {
          ok: false,
          error: `Game ROM / disc images (${ext}) aren't allowed. Share a patch file (such as .ips, .bps, or .xdelta) instead.`,
        };
      }

      if (EXECUTABLE_EXTS.has(ext)) {
        warningSet.add(`Contains executable/binary files (${ext})`);
      }

      if (entries.length < MAX_STORED_ENTRIES) {
        entries.push({ name: normalized, size: uncompressed32 });
      }
    }

    cursor += recordLen;
  }

  const ratio = totalUncompressed / Math.max(buf.length, 1);
  if (totalUncompressed > SUSPICIOUS_RATIO_MIN_BYTES && ratio > MAX_COMPRESSION_RATIO) {
    return { ok: false, error: "That .zip archive has an unsafe compression ratio and was rejected." };
  }

  return {
    ok: true,
    sha256,
    manifest: {
      file_count: fileCount,
      total_uncompressed: totalUncompressed,
      entries,
      warnings: [...warningSet],
    },
  };
}
