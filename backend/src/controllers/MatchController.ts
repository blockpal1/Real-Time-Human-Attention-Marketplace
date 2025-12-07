import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const acceptMatch = async (req: Request, res: Response) => {
    const { matchId } = req.body;
    try {
        const match = await prisma.match.findUnique({ where: { id: matchId } });

        if (!match || match.status !== 'offered') {
            return res.status(400).json({ error: 'Match not available or already processed' });
        }

        await prisma.match.update({
            where: { id: matchId },
            data: { status: 'active', startTime: new Date() }
        });

        console.log(`Match ${matchId} ACCEPTED and ACTIVE`);
        res.json({ status: 'ok' });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error accepting match' });
    }
};

export const rejectMatch = async (req: Request, res: Response) => {
    const { matchId } = req.body;
    try {
        await prisma.match.update({
            where: { id: matchId },
            data: { status: 'rejected' }
        });
        console.log(`Match ${matchId} REJECTED`);
        res.json({ status: 'ok' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error rejecting match' });
    }
};

export const submitQA = async (req: Request, res: Response) => {
    const { matchId, answer } = req.body;
    try {
        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: { bid: true, session: true }
        });

        if (!match || match.status !== 'active') {
            return res.status(400).json({ error: 'Match not active' });
        }

        // Logic: Pay regardless of answer? Or pay bonus for YES?
        // Spec says: "Answer required to fulfill contract"
        // We settle here.

        const amount = match.bid.maxPricePerSecond * match.bid.durationPerUser;

        // 1. Update Match
        await prisma.match.update({
            where: { id: matchId },
            data: {
                status: 'completed',
                endTime: new Date(),
                validationAnswer: answer
            }
        });

        // 2. Create Settlement Record (Mock Payment)
        await prisma.settlement.create({
            data: {
                matchId: match.id,
                amount: amount,
                status: 'confirmed', // Assume instant settlement for MVP
                transactionSig: 'mock-solana-sig-' + Date.now()
            }
        });

        console.log(`Match ${matchId} COMPLETED. Payment: ${amount} micros.`);
        res.json({ status: 'ok', amount_paid: amount });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error submitting QA' });
    }
};
