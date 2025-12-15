import { Request, Response, NextFunction } from 'express';

/**
 * Admin authentication middleware
 * Expects: X-Admin-Secret header matching ADMIN_SECRET env var
 */
export const authenticateAdmin = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
        console.warn('[Admin] ADMIN_SECRET not set - admin routes disabled');
        return res.status(503).json({ error: 'Admin routes not configured' });
    }

    const providedSecret = req.headers['x-admin-secret'];

    if (providedSecret !== adminSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};
