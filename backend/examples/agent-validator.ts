/**
 * Example: Agent WebSocket Listener for Match Validation
 * 
 * This demonstrates how an AI agent can listen for MATCH_COMPLETED events
 * and submit validation results back to the marketplace.
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3000/v1/ws/events';
const API_URL = 'http://localhost:3000/v1';

// Connect to marketplace WebSocket
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('Agent connected to marketplace');

    // Authenticate as agent (if needed)
    ws.send(JSON.stringify({
        type: 'AUTH',
        agentPubkey: 'mock-agent-pubkey'
    }));
});

ws.on('message', async (data) => {
    const message = JSON.parse(data.toString());

    // Listen for match completion events
    if (message.type === 'MATCH_COMPLETED') {
        const { matchId, validationQuestion, validationAnswer, actualDuration, exitedEarly } = message.payload;

        console.log('\n📬 Match Completed:', {
            matchId,
            question: validationQuestion,
            answer: validationAnswer,
            duration: actualDuration,
            exitedEarly
        });

        // Validate the answer (could use AI for semantic matching)
        const isValid = validateAnswer(validationQuestion, validationAnswer);

        console.log(`✅ Validation result: ${isValid ? 'APPROVED' : 'REJECTED'}`);

        // Submit validation result back to marketplace
        await submitValidationResult(matchId, {
            result: isValid ? 'approved' : 'rejected',
            reason: isValid ? null : 'Answer does not match expected response'
        });
    }

    // Listen for validation confirmations
    if (message.type === 'VALIDATION_RESULT') {
        console.log('\n✅ Validation confirmed:', message.payload);
    }
});

/**
 * Smart answer validation
 * In production, this could use Claude/GPT for semantic matching
 */
function validateAnswer(question: string | undefined, answer: string): boolean {
    if (!question || !answer) return false;

    const answerLower = answer.toLowerCase();
    const questionLower = question.toLowerCase();

    // Simple keyword matching
    if (questionLower.includes('logo')) {
        return answerLower.includes('yes') || answerLower.includes('saw') || answerLower.includes('noticed');
    }

    if (questionLower.includes('color')) {
        return answerLower.includes('red') || answerLower.includes('blue') || answerLower.includes('green');
    }

    // For open-ended questions, accept any non-empty answer
    return answer.trim().length > 0;
}

/**
 * Submit validation result to marketplace API
 */
async function submitValidationResult(matchId: string, data: { result: string; reason: string | null }) {
    try {
        const response = await fetch(`${API_URL}/matches/${matchId}/validation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`Validation submission failed: ${response.statusText}`);
        }

        console.log(`✅ Validation result submitted for match ${matchId}`);

    } catch (error) {
        console.error('❌ Failed to submit validation:', error);
    }
}

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

ws.on('close', () => {
    console.log('Agent disconnected from marketplace');
});
