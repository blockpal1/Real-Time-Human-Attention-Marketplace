import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const startSessionSchema = z.object({
    pubkey: z.string(),
    price_floor_micros: z.number().int().positive(),
    device_attestation: z.string().optional()
});

export const startSession = async (req: Request, res: Response) => {
    const result = startSessionSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    const { pubkey, price_floor_micros, device_attestation } = result.data;

    try {
        // Upsert User
        await prisma.user.upsert({
            where: { pubkey },
            update: {},
            create: { pubkey }
        });

        // Create Session
        const session = await prisma.session.create({
            data: {
                userPubkey: pubkey,
                priceFloor: price_floor_micros,
                deviceAttestation: device_attestation || null,
                active: true,
                connected: false // Will be set to true on WS connect
            }
        });

        // Generate Token
        const secret = process.env.JWT_SECRET || 'dev-secret';
        const token = jwt.sign({ sessionId: session.id, pubkey }, secret, { expiresIn: '1h' });

        // Publish ASK_CREATED event
        if (!redis.isOpen) await redis.connect();
        await redis.publish('marketplace_events', JSON.stringify({
            type: 'ASK_CREATED',
            payload: {
                id: session.id, // Use session ID as Ask ID
                pricePerSecond: price_floor_micros,
                status: 'active'
            }
        }));

        res.json({ session_token: token });

    } catch (error) {
        console.error('Start Session Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
