
import { prisma } from './src/utils/prisma';

async function check() {
    const bids = await prisma.bid.count();
    const sessions = await prisma.session.count();
    const matches = await prisma.match.count();
    const activeSessions = await prisma.session.findMany({ where: { active: true } });

    console.log({ bids, sessions, matches });
    console.log("Active Sessions:", activeSessions);
}

check();
