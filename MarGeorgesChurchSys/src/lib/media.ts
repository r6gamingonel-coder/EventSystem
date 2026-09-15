import { mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

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

  await mkdir(UPLOAD_DIR, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const filename = `${randomUUID()}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  // Optimize: cap max dimension and normalize orientation, keep original format.
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();

  const resized = image.resize({
    width: 2000,
    height: 2000,
    fit: "inside",
    withoutEnlargement: true,
  });

  await resized.toFile(filePath);

  const blurBuffer = await sharp(buffer)
    .resize(16, 16, { fit: "inside" })
    .blur()
    .toFormat("jpeg", { quality: 40 })
    .toBuffer();
  const blurDataUrl = `data:image/jpeg;base64,${blurBuffer.toString("base64")}`;

  return {
    url: `/uploads/${filename}`,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    blurDataUrl,
    sizeBytes: buffer.byteLength,
  };
}
