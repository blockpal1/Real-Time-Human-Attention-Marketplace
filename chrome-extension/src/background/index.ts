import { ExtensionState, ExtensionStatus, OfferDetails } from '../types';

console.log('Background service worker started');

// State
let currentState: ExtensionState = 'IDLE';
let currentOffer: OfferDetails | undefined = undefined;
let currentEarnings = 0.00;
let ws: WebSocket | null = null;
let offerTimer: any = null;

// Mock session
const sessionToken = "mock-jwt-session-123";

// Broadcast status to Popup
function broadcastStatus() {
    const status: ExtensionStatus = {
        state: currentState,
        offer: currentOffer,
        currentEarnings
    };
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', payload: status }).catch(() => {
        // Popeup likely closed, ignore
    });
}

function handleMatchFound(data: any) {
    console.log('Match Found:', data);

    // Create Offer
    currentOffer = {
        bidId: data.bidId || 'mock-bid-1',
        price: data.price || 0.0001,
        duration: data.duration || 10,
        topic: data.category || 'General Content',
        contentUrl: data.content_url || 'https://www.w3schools.com/html/mov_bbb.mp4',
        question: data.validation_question || 'Is the video playing?',
        expiresAt: Date.now() + 30000 // 30s timeout
    };

    currentState = 'OFFER_RECEIVED';
    broadcastStatus();

    // Auto-reject after 30s
    if (offerTimer) clearTimeout(offerTimer);
    offerTimer = setTimeout(() => {
        if (currentState === 'OFFER_RECEIVED') {
            console.log('Offer timed out');
            currentState = 'SEARCHING';
            currentOffer = undefined;
            broadcastStatus();
        }
    }, 30000);

    // Show Notification
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png', // Ensure this exists or remove
        title: 'New Bid Found!',
        message: `Watch ${currentOffer.topic} for $${(currentOffer.price * currentOffer.duration).toFixed(4)}?`,
        priority: 2
    });
}

const MAX_RETRIES = 5;
let retryCount = 0;

function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    ws = new WebSocket('ws://localhost:3000/ws/events');

    ws.onopen = () => {
        console.log('WS Connected');
        retryCount = 0; // Reset retries on success
        ws?.send(JSON.stringify({ type: 'AUTH', token: sessionToken }));
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'MATCH_FOUND') {
                handleMatchFound(msg.payload);
            }
        } catch (e) {
            console.error('WS Parse Error', e);
        }
    };

    ws.onclose = () => {
        console.log('WS Closed. Retrying...');
        ws = null;

        if (currentState !== 'IDLE' && retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(connectWebSocket, 2000); // Retry in 2s
        } else if (retryCount >= MAX_RETRIES) {
            console.log('Max retries reached. Going IDLE.');
            currentState = 'IDLE';
            broadcastStatus();
        }
    };
}

// Create offscreen document (for ML)
async function createOffscreen() {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
        url: 'src/offscreen/index.html',
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification: 'Real-time face tracking',
    });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
        case 'GET_STATUS':
            sendResponse({
                state: currentState,
                offer: currentOffer,
                currentEarnings
            });
            break;

        case 'START_SESSION':
            console.log('Starting Session...');
            connectWebSocket();
            currentState = 'SEARCHING';
            createOffscreen();
            broadcastStatus();
            sendResponse({ status: 'ok' });
            break;

        case 'STOP_SESSION':
            console.log('Stopping Session...');
            if (ws) {
                // Prevent auto-reconnect logic
                retryCount = MAX_RETRIES + 1;
                ws.close();
                ws = null;
            }
            // Cleanup offscreen
            chrome.offscreen.closeDocument().catch(() => { });

            currentState = 'IDLE';
            broadcastStatus();
            sendResponse({ status: 'ok' });
            break;

        case 'ACCEPT_OFFER':
            if (currentState === 'OFFER_RECEIVED' && currentOffer) {
                console.log('Offer Accepted');
                if (offerTimer) clearTimeout(offerTimer);
                currentState = 'ACTIVE_TASK';
                broadcastStatus();
                // TODO: Inject content script logic here to show video
            }
            break;

        case 'REJECT_OFFER':
            if (currentState === 'OFFER_RECEIVED') {
                if (offerTimer) clearTimeout(offerTimer);
                currentState = 'SEARCHING'; // Go back to pool
                currentOffer = undefined;
                broadcastStatus();
            }
            break;

        case 'SUBMIT_QA':
            // Finish task
            console.log('QA Submitted');
            currentState = 'SEARCHING'; // Back to loop
            currentEarnings += ((currentOffer?.price || 0) * (currentOffer?.duration || 0));
            currentOffer = undefined;
            broadcastStatus();
            break;

        case 'ENGAGEMENT_DATA':
            // Forward measurement
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ENGAGEMENT', data: message.payload }));
            }
            break;
    }
    return true;
});
