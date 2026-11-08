import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { cloudinaryEnabled, env, isProd } from './config/env.js';
import { pool } from './db/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiLimiter, csrfGuard } from './middleware/security.js';
import adminRouter from './routes/admin/index.js';
import authRouter from './routes/auth.js';
import publicRouter from './routes/public.js';
import seoRouter from './routes/seo.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind Nginx / Render / Railway etc. so req.ip & secure cookies work
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'frame-src': ['https://www.google.com', 'https://maps.google.com'],
          'connect-src': ["'self'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );

  const origins = [env.CLIENT_URL, env.PUBLIC_SITE_URL, ...env.CORS_ORIGINS.split(',').map((s) => s.trim())].filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-Requested-With'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan(isProd ? 'combined' : 'dev'));

  app.get('/api/health', async (_req, res) => {
    let database = 'up';
    try {
      await pool.query('select 1');
    } catch {
      database = 'down';
    }
    res.status(database === 'up' ? 200 : 503).json({ status: 'ok', database, imageStorage: cloudinaryEnabled ? 'cloudinary' : 'local' });
  });

  app.use('/api', apiLimiter, csrfGuard);
  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', notFoundHandler);

  app.use(seoRouter);

  // Locally stored uploads (only used when Cloudinary is not configured)
  app.use(
    '/uploads',
    express.static(path.resolve(env.UPLOAD_DIR), {
      maxAge: '30d',
      immutable: true,
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  // Single-server deployment: serve the built React app with SPA fallback
  if (env.SERVE_CLIENT) {
    const dist = path.resolve(env.CLIENT_DIST_DIR);
    if (fs.existsSync(dist)) {
      app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '1y', immutable: true }));
      app.use(express.static(dist, { index: false, maxAge: '1h' }));
      app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
        res.set('Cache-Control', 'no-cache');
        res.sendFile(path.join(dist, 'index.html'));
      });
    } else {
      console.warn(`⚠️  SERVE_CLIENT=true but ${dist} does not exist. Run "npm run build" in /client first.`);
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
