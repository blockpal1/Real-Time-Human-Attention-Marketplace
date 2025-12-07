import { Request, Response } from 'express';
import crypto from 'crypto';

export const createChallenge = (req: Request, res: Response) => {
    const nonce = crypto.randomBytes(32).toString('base64');
    res.status(201).json({
        nonce,
        timestamp: Date.now()
    });
};
