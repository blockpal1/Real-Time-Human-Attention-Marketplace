import fetch from 'node-fetch';

const GATEWAY_URL = 'http://localhost:3000/v1/bids';

const RANDOM_URLS = [
    'https://example.com/ad1',
    'https://example.com/ad2',
    'https://example.com/promotion',
    'https://brand.com/campaign'
];

async function submitBid() {
    const price = 10 + Math.floor(Math.random() * 90); // 10-100 micros
    const score = 0.3 + (Math.random() * 0.6); // 0.3 - 0.9 required score

    const bid = {
        max_price_per_second: price,
        required_attention_score: parseFloat(score.toFixed(2)),
        target_url: RANDOM_URLS[Math.floor(Math.random() * RANDOM_URLS.length)]
    };

    try {
        const start = Date.now();
        const res = await fetch(GATEWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bid)
        });
        const data = await res.json();
        const duration = Date.now() - start;
        console.log(`[Agent] Placed bid ${data.bid_id} @ ${price}µs (req: ${bid.required_attention_score}) - ${duration}ms`);
    } catch (e) {
        console.error('[Agent] Error submitting bid:', e.message);
    }
}

console.log('Starting Agent Activity Simulation...');
console.log('Generating random bids every 2.5 seconds...');

// Loop
setInterval(submitBid, 2500);
