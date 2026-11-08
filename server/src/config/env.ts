import 'dotenv/config';
import { z } from 'zod';

/** Hide the password when printing a connection string in logs. */
export function maskUrl(v: string) {
  return v.replace(/(\/\/[^:/@]+:)[^@]*@/, '$1****@').slice(0, 160) || '(empty)';
}

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is required' })
    // Forgive common copy-paste mistakes: quotes, spaces, "DATABASE_URL=" or "psql '...'" wrappers
    .transform((v) =>
      v
        .trim()
        .replace(/^DATABASE_URL\s*=\s*/i, '')
        .replace(/^psql\s+/i, '')
        .replace(/^['"]+|['"]+$/g, '')
        .trim(),
    )
    .refine((v) => /^postgres(ql)?:\/\/[^@\s]+@[^/\s]+\/\S+$/.test(v), (v) => ({
      message: `DATABASE_URL must look like postgresql://user:password@host/dbname — got "${maskUrl(v)}"`,
    })),
  DATABASE_SSL: bool,
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().optional().default(''),
  SERVE_CLIENT: bool,
  CLIENT_DIST_DIR: z.string().default('../client/dist'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  CLOUDINARY_FOLDER: z.string().default('sakshi-mobile'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(5),
  BACKUP_DIR: z.string().default('./backups'),
  PG_DUMP_PATH: z.string().default('pg_dump'),
  BACKUP_RETENTION: z.coerce.number().int().positive().default(14),
  // WhatsApp Business Cloud API (automatic bill sending) — optional
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_TEMPLATE_NAME: z.string().default('bill_invoice'),
  WHATSAPP_TEMPLATE_LANG: z.string().default('en'),
  WHATSAPP_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default('v23.0'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const whatsappApiEnabled = Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
