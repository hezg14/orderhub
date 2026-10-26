import { Router } from 'express';
import { asyncHandler, ok, reqLocale } from '../lib/http';
import { authenticate } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { validateQuery } from '../middlewares/validate';
import { reportQuery, type ReportQuery } from '../schemas';
import { buildReport, csvFilename, toCsv } from '../services/report.service';

export const reportsRouter = Router();

// Reports and exports are owner-only (PRD §4.8).
reportsRouter.use(authenticate, requireRole('admin'));

reportsRouter.get(
  '/preview',
  validateQuery(reportQuery),
  asyncHandler(async (req, res) => {
    const report = await buildReport(req.query as unknown as ReportQuery, 5, reqLocale(req));
    return ok(res, report);
  }),
);

reportsRouter.get(
  '/export',
  validateQuery(reportQuery),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as ReportQuery;
    const report = await buildReport(q, undefined, reqLocale(req));
    const csv = toCsv(report);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${csvFilename(report.type, report.range)}"`);
    // Lets the browser show "412 rows" instead of guessing from the stream.
    res.setHeader('X-Total-Rows', String(report.total));
    res.setHeader('Cache-Control', 'no-store');

    return res.send(csv);
  }),
);
