import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

/**
 * Get campaign analytics and response aggregation for an agent
 */
export const getCampaignResponses = async (req: Request, res: Response) => {
    const { bidId } = req.params;

    try {
        // Get bid details
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            include: {
                matches: {
                    where: {
                        status: 'completed',
                        validationAnswer: { not: null }
                    }
                }
            }
        });

        if (!bid) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Calculate campaign stats
        const totalResponses = bid.matches.length;
        const targetResponses = bid.targetQuantity;
        const completionRate = totalResponses > 0
            ? bid.matches.filter(m => !m.humanExitedEarly).length / totalResponses
            : 0;

        // Aggregate answers (group similar responses)
        const answerCounts: { [key: string]: number } = {};
        const rawAnswers: string[] = [];

        bid.matches.forEach(match => {
            if (match.validationAnswer) {
                const normalized = match.validationAnswer.toLowerCase().trim();
                answerCounts[normalized] = (answerCounts[normalized] || 0) + 1;
                rawAnswers.push(match.validationAnswer);
            }
        });

        // Sort by count (most common first)
        const sortedAnswers = Object.entries(answerCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([answer, count]) => ({ answer, count }));

        // Find consensus (most common answer)
        const consensus = sortedAnswers.length > 0
            ? {
                answer: sortedAnswers[0].answer,
                percentage: (sortedAnswers[0].count / totalResponses) * 100,
                count: sortedAnswers[0].count
            }
            : null;

        // Calculate budget metrics
        const pricePerSecond = bid.maxPricePerSecond / 1_000_000;
        const budgetSpent = bid.matches.reduce((sum, m) => {
            const duration = m.actualDuration || bid.durationPerUser;
            return sum + (pricePerSecond * duration);
        }, 0);

        res.json({
            campaign: {
                bidId: bid.id,
                question: bid.validationQuestion,
                contentUrl: bid.contentUrl,
                targetUrl: bid.targetUrl,
                createdAt: bid.createdAt
            },
            stats: {
                totalResponses,
                targetResponses,
                progress: (totalResponses / targetResponses) * 100,
                completionRate: completionRate * 100,
                budgetSpent: Number(budgetSpent.toFixed(4)),
                pricePerResponse: totalResponses > 0 ? Number((budgetSpent / totalResponses).toFixed(4)) : 0
            },
            responses: {
                aggregated: sortedAnswers,
                raw: rawAnswers,
                consensus
            }
        });

    } catch (error) {
        console.error('Get Campaign Responses Error:', error);
        res.status(500).json({ error: 'Failed to fetch campaign responses' });
    }
};

/**
 * Get all campaigns for an agent
 */
export const getAgentCampaigns = async (req: Request, res: Response) => {
    const { pubkey } = req.params;

    try {
        const bids = await prisma.bid.findMany({
            where: {
                agentPubkey: pubkey,
                active: true
            },
            include: {
                _count: {
                    select: {
                        matches: {
                            where: { status: 'completed' }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const campaigns = bids.map(bid => ({
            bidId: bid.id,
            question: bid.validationQuestion,
            contentUrl: bid.contentUrl,
            targetResponses: bid.targetQuantity,
            completedResponses: bid._count.matches,
            progress: (bid._count.matches / bid.targetQuantity) * 100,
            createdAt: bid.createdAt,
            status: bid._count.matches >= bid.targetQuantity ? 'completed' : 'active'
        }));

        res.json(campaigns);

    } catch (error) {
        console.error('Get Agent Campaigns Error:', error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
};
