import { emitEvent, STREAM_SETTLEMENT_INSTRUCTIONS } from '../infra';
import { SettlementInstruction } from '../types/match';
import { SettlementInstructionEvent } from '../types/events';

/**
 * SettlementEmitter - Utility for emitting settlement instructions to Payment Router
 * 
 * This is primarily used by the Matcher, but exposed separately for flexibility
 */
export class SettlementEmitter {
    /**
     * Emit a settlement instruction
     */
    async emit(instruction: SettlementInstruction): Promise<string> {
        const event: SettlementInstructionEvent = {
            type: 'settlement_instruction',
            timestamp: Date.now(),
            instruction,
        };

        const eventId = await emitEvent(STREAM_SETTLEMENT_INSTRUCTIONS, event);

        console.log(
            `[SettlementEmitter] Emitted settlement for match ${instruction.matchId}: ` +
            `${instruction.verifiedSeconds}s × ${instruction.agreedPricePerSecond} = ${instruction.totalAmount} micro-USDC`
        );

        return eventId;
    }

    /**
     * Create a settlement instruction from match data
     */
    static createInstruction(
        matchId: string,
        agentPubkey: string,
        userPubley: string,
        verifiedSeconds: number,
        agreedPricePerSecond: number
    ): SettlementInstruction {
        return {
            matchId,
            escrowAccount: agentPubkey, // In production, would look up actual escrow
            userWallet: userPubley,
            verifiedSeconds,
            agreedPricePerSecond,
            totalAmount: verifiedSeconds * agreedPricePerSecond,
            nonce: Date.now(),
            createdAt: Date.now(),
        };
    }
}
