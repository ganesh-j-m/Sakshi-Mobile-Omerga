import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryEnabled, env } from '../config/env.js';
import { badRequest } from './http.js';

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

/** Verify the file really is the image type it claims to be (magic bytes), not just its extension. */
export function detectImageType(buf: Buffer): (typeof ALLOWED_MIME)[number] | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 4, 8) === 'ftyp' && /avi[fs]/.test(buf.toString('ascii', 8, 12))) return 'image/avif';
  return null;
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export type StoredImage = { url: string; publicId: string | null; width?: number; height?: number };

export async function storeImage(buffer: Buffer, folder: string): Promise<StoredImage> {
  const type = detectImageType(buffer);
  if (!type) throw badRequest('Only JPG, PNG, WEBP or AVIF images are allowed');
  if (buffer.length > env.MAX_UPLOAD_MB * 1024 * 1024) throw badRequest(`Image must be under ${env.MAX_UPLOAD_MB} MB`);

  const safeFolder = folder.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'misc';

  if (cloudinaryEnabled) {
    const result = await new Promise<{ secure_url: string; public_id: string; width: number; height: number }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `${env.CLOUDINARY_FOLDER}/${safeFolder}`,
            resource_type: 'image',
            // Re-encode on Cloudinary's side & strip metadata
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          },
          (err, res) => (err || !res ? reject(err ?? new Error('Upload failed')) : resolve(res as never)),
        );
        stream.end(buffer);
      },
    );
    return { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height };
  }

  // Local-disk fallback (development / single-server setups)
  const dir = path.resolve(env.UPLOAD_DIR, safeFolder);
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${EXT[type]}`;
  await fs.writeFile(path.join(dir, name), buffer);
  return { url: `/uploads/${safeFolder}/${name}`, publicId: null };
}

export async function deleteImage(publicId: string | null | undefined) {
  if (!publicId || !cloudinaryEnabled) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('cloudinary delete failed', err);
  }
}

/** Build an optimised Cloudinary URL (no-op for non-Cloudinary URLs). */
export function optimisedUrl(url: string, width = 800) {
  if (!url.includes('res.cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}
