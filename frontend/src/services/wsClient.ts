type Subscriber = (data: any) => void;

class WSClient {
    private ws: WebSocket | null = null;
    private subscribers: Map<string, Set<Subscriber>> = new Map();
    private reconnectInterval = 3000;
    private url: string;

    constructor(url: string) {
        this.url = url;
    }

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            console.log('WS already connected or connecting');
            return;
        }

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('WS Connected');
                this.notify('status', { status: 'connected' });
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type) {
                        console.log(`WS Received type: ${data.type}`, data);
                        this.notify(data.type, data.payload || data);
                    }
                } catch (e) {
                    console.error('WS Parse Error', e);
                }
            };

            this.ws.onclose = () => {
                console.log('WS Closed, reconnecting...');
                this.notify('status', { status: 'disconnected' });
                setTimeout(() => this.connect(), this.reconnectInterval);
            };

            this.ws.onerror = (err) => {
                console.error('WS Error', err);
            };

        } catch (e) {
            console.error('WS Connection Error', e);
        }
    }

    subscribe(topic: string, callback: Subscriber) {
        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, new Set());
        }
        this.subscribers.get(topic)?.add(callback);
        return () => this.subscribers.get(topic)?.delete(callback);
    }

    private notify(topic: string, data: any) {
        this.subscribers.get(topic)?.forEach(cb => cb(data));
        // Also notify wildcard subscribers
        this.subscribers.get('*')?.forEach(cb => cb({ topic, data }));
    }

    send(data: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('WS not connected, cannot send:', data);
        }
    }
}

// Construct WS URL from API URL (http -> ws, https -> wss)
const getWsUrl = () => {
    // Check for explicit WS URL first
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;

    // Otherwise derive from API URL
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/v1';
    const protocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    // Remove protocol and ensure path is correct
    const host = apiUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${protocol}://${host}/ws/events`; // API_URL usually includes /v1, so we verify path

    // If API_URL already has /v1, we use it. If not, we might need to append it?
    // Hardcoded fallback was: ws://localhost:3000/v1/ws/events
    // API_URL fallback is: http://localhost:3000/v1
    // So apiUrl.replace -> localhost:3000/v1
    // Result: ws://localhost:3000/v1/ws/events
    return wsUrl;
};

export const wsClient = new WSClient(getWsUrl());
