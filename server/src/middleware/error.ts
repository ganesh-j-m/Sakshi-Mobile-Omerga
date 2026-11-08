import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { isProd } from '../config/env.js';
import { AppError } from '../lib/http.js';

type PgError = { code?: string; detail?: string; constraint?: string };

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large' : err.message;
    return res.status(400).json({ error: msg });
  }
  const pg = (err as { cause?: PgError })?.cause ?? (err as PgError);
  if (pg?.code === '23505') {
    return res.status(409).json({ error: 'A record with the same unique value already exists', details: pg.constraint });
  }
  if (pg?.code === '23503') {
    return res.status(409).json({ error: 'This record is linked to other data and cannot be changed this way' });
  }
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side', ...(isProd ? {} : { debug: String(err) }) });
}
