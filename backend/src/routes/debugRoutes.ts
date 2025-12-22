import { Router, Request, Response } from 'express';

const router = Router();

// Debug endpoint to test admin key
router.get('/debug/admin-key', (req: Request, res: Response) => {
    const adminKeyHeader = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_SECRET;

    res.json({
        received: adminKeyHeader,
        expected: expectedKey,
        match: adminKeyHeader === expectedKey,
        receivedType: typeof adminKeyHeader,
        expectedType: typeof expectedKey
    });
});

export default router;
