import { mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { put, del } from "@vercel/blob";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// On Vercel (and any host where the filesystem is read-only/ephemeral),
// BLOB_READ_WRITE_TOKEN is set once Vercel Blob storage is enabled for the
// project — uploads go there instead of local disk. Locally (no token),
// files are written to public/uploads for simplicity.
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

export type SavedFile = {
  url: string;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
  sizeBytes: number;
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE_BYTES = 12 * 1024 * 1024; // 12MB

export async function saveUploadedImage(file: File): Promise<SavedFile> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, WEBP, GIF.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("حجم الملف كبير جداً (الحد الأقصى 12 ميغابايت).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const filename = `${randomUUID()}.${ext}`;

  // Optimize: cap max dimension and normalize orientation, keep original format.
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();
  const optimizedBuffer = await image
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .toBuffer();

  const blurBuffer = await sharp(buffer)
    .resize(16, 16, { fit: "inside" })
    .blur()
    .toFormat("jpeg", { quality: 40 })
    .toBuffer();
  const blurDataUrl = `data:image/jpeg;base64,${blurBuffer.toString("base64")}`;

  const url = USE_BLOB
    ? await saveToBlob(filename, optimizedBuffer, file.type)
    : await saveToDisk(filename, optimizedBuffer);

  return {
    url,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    blurDataUrl,
    sizeBytes: optimizedBuffer.byteLength,
  };
}

async function saveToDisk(filename: string, buffer: Buffer): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const fs = await import("fs/promises");
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

async function saveToBlob(filename: string, buffer: Buffer, contentType: string): Promise<string> {
  const blob = await put(`uploads/${filename}`, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return blob.url;
}

/** Best-effort delete — never throws, since a missing file shouldn't block deleting the DB record. */
export async function deleteUploadedImage(url: string): Promise<void> {
  try {
    if (url.includes("blob.vercel-storage.com")) {
      await del(url);
    } else {
      const fs = await import("fs/promises");
      await fs.unlink(path.join(process.cwd(), "public", url));
    }
  } catch {
    // Already gone or storage unreachable — the DB record is the source of truth.
  }
}
