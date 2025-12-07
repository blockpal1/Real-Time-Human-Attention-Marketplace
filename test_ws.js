const WebSocket = require('ws');

console.log('Attempting connection to ws://localhost:3000/ws/monitor...');
const ws = new WebSocket('ws://localhost:3000/ws/monitor');

ws.on('open', () => {
    console.log('✅ Connected to WebSocket!');
});

ws.on('message', (data) => {
    console.log('📩 Received:', data.toString());
});

setTimeout(() => {
    console.log('Test complete, closing.');
    ws.close();
}, 10000);

ws.on('error', (err) => {
    console.error('❌ Error:', err.message);
});

ws.on('close', (code, reason) => {
    console.log(`Connection closed: ${code} ${reason}`);
});
