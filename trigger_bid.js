const fetch = require('node-fetch'); // Assuming node-fetch is available or using built-in fetch in newer Node

async function main() {
    try {
        console.log("Submitting Bid...");
        const response = await fetch('http://localhost:3000/v1/agents/bids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_quantity: 1,
                duration_per_user: 30,
                max_price_per_second: 60000,
                category: "meme",
                required_attention_score: 0.5,
                validation_question: "Did you see the logo?"
            })
        });

        if (response.ok) {
            console.log("Bid Submitted: HTTP " + response.status);
            const json = await response.json();
            console.log(json);
        } else {
            console.error("Bid Failed: HTTP " + response.status);
            const text = await response.text();
            console.error(text);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
