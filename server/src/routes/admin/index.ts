import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../../middleware/auth.js';
import billsRouter from './bills.js';
import branchesRouter from './branches.js';
import branchProductsRouter from './branchProducts.js';
import cmsRouter from './cms.js';
import dashboardRouter from './dashboard.js';
import inquiriesRouter from './inquiries.js';
import offersRouter from './offers.js';
import productsRouter from './products.js';
import reportsRouter from './reports.js';
import { bannersRouter, brandsRouter, categoriesRouter, testimonialsRouter, variantsRouter } from './resources.js';
import settingsRouter from './settings.js';
import { backupsRouter, logsRouter, uploadsRouter } from './system.js';
import usersRouter from './users.js';

const router = Router();

// Every admin endpoint requires a valid session; module checks happen per route.
router.use(requireAuth);
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.use('/dashboard', dashboardRouter);
router.use('/products', productsRouter);
router.use('/variants', variantsRouter);
router.use('/brands', brandsRouter);
router.use('/categories', categoriesRouter);
router.use('/offers', offersRouter);
router.use('/branches', branchesRouter);
router.use('/branch-products', branchProductsRouter);
router.use('/inquiries', inquiriesRouter);
router.use('/testimonials', testimonialsRouter);
router.use('/banners', bannersRouter);
router.use('/cms', cmsRouter);
router.use('/reports', reportsRouter);
router.use('/uploads', uploadsRouter);
router.use('/bills', billsRouter);

// Super Admin only
router.use('/users', requireSuperAdmin, usersRouter);
router.use('/settings', requireSuperAdmin, settingsRouter);
router.use('/activity-logs', logsRouter);
router.use('/backups', backupsRouter);

export default router;
