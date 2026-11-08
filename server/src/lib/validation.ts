import { z } from 'zod';

/** Strip HTML tags & control characters from free text (defence-in-depth against stored XSS). */
export const cleanText = (v: string) =>
  v
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();

export const text = (max = 255) => z.string().max(max).transform(cleanText);
export const requiredText = (max = 255, min = 1) =>
  z.string().max(max).transform(cleanText).pipe(z.string().min(min, 'Required'));

/** Optional text: '' / null → null */
export const optText = (max = 255) =>
  z
    .union([z.string().max(max), z.null()])
    .optional()
    .transform((v) => (v == null ? null : cleanText(v) || null));

export const optUrl = z
  .union([z.string().max(1000), z.null()])
  .optional()
  .transform((v) => (v ? v.trim() : null))
  .refine((v) => v === null || /^(https?:\/\/|\/)/i.test(v), 'Must be a URL (http/https) or site path');

export const optInt = z
  .union([z.coerce.number().int(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v == null ? null : v));

export const optDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), 'Invalid date');

/** Indian mobile number: 10 digits, optional +91 / 0 prefix → normalised to 10 digits. */
export const indianMobile = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|0091|91|0)(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'));

export const optPhone = z
  .union([z.string().max(20), z.null()])
  .optional()
  .transform((v) => (v ? v.replace(/[^\d+]/g, '') || null : null))
  .refine((v) => v === null || /^\+?\d{10,13}$/.test(v), 'Enter a valid phone number');

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Use a hex colour like #1E3A8A');

export const csvList = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []));

export const csvInts = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(',')
          .map((s) => Number(s))
          .filter((n) => Number.isInteger(n) && n >= 0)
      : [],
  );

export const boolQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));
