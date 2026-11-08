import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../lib/http.js';

const json = (message: string) => ({ error: message });

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many requests. Please try again shortly.'),
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: json('Too many login attempts. Please wait 15 minutes and try again.'),
});

export const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('You have sent several inquiries already. Please try again later or contact us on WhatsApp.'),
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Upload limit reached. Please wait a few minutes.'),
});

/**
 * CSRF defence for cookie-authenticated, state-changing requests:
 * only accept JSON / multipart bodies (HTML forms cannot send application/json cross-site)
 * and require the custom header the SPA always sends.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'SakshiMobile') {
    return next(new AppError(403, 'Request blocked (missing client header)'));
  }
  next();
}
