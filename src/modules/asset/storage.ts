import { createHash, randomBytes } from "node:crypto";
import { access, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env";

export function storageRoot(): string {
  return path.resolve(env.STORAGE_ROOT);
}

export function originalPath(contentHash: string): string {
  return path.join(storageRoot(), "originals", contentHash.slice(0, 2), contentHash);
}

export function variantPath(contentHash: string, transformHash: string, ext: string): string {
  return path.join(storageRoot(), "variants", contentHash, `${transformHash}.${ext}`);
}

export function variantDir(contentHash: string): string {
  return path.join(storageRoot(), "variants", contentHash);
}

export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function newPublicId(): string {
  return randomBytes(12).toString("base64url");
}

export async function ensureStorage(): Promise<void> {
  await mkdir(path.join(storageRoot(), "originals"), { recursive: true });
  await mkdir(path.join(storageRoot(), "variants"), { recursive: true });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeOriginal(contentHash: string, buffer: Buffer): Promise<string> {
  const dest = originalPath(contentHash);
  if (await exists(dest)) return dest;
  await mkdir(path.dirname(dest), { recursive: true });
  try {
    await writeFile(dest, buffer, { flag: "wx" });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw error;
  }
  return dest;
}

export async function writeVariant(
  contentHash: string,
  transformHash: string,
  ext: string,
  buffer: Buffer,
): Promise<string> {
  const dest = variantPath(contentHash, transformHash, ext);
  if (await exists(dest)) return dest;
  await mkdir(path.dirname(dest), { recursive: true });
  try {
    await writeFile(dest, buffer, { flag: "wx" });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw error;
  }
  return dest;
}

export async function variantExists(
  contentHash: string,
  transformHash: string,
  ext: string,
): Promise<boolean> {
  return exists(variantPath(contentHash, transformHash, ext));
}

export async function originalExists(contentHash: string): Promise<boolean> {
  return exists(originalPath(contentHash));
}

export async function removeBlobIfOrphaned(contentHash: string): Promise<void> {
  await unlink(originalPath(contentHash)).catch(() => undefined);
  await rm(variantDir(contentHash), { recursive: true, force: true });
}

export function sanitizeOriginalName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, "_").trim();
  return (base || "image").slice(0, 180);
}

export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
