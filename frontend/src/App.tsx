import React from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { OrderBook } from './components/OrderBook';
import { PriceFloorSetter } from './components/PriceFloorSetter';
import { PlaceBid } from './components/PlaceBid';
import { wsClient } from './services/wsClient';
import FocusPortal from './pages/FocusPortal';

interface MatchNotification {
    matchId: string;
    price: number;
    duration: number;
    topic?: string;
}

interface MatchHistoryItem {
    price: number;
    duration: number;
    time: string;
}

function App() {
    const [view, setView] = React.useState<'agent' | 'human'>('agent');
    const [duration, setDuration] = React.useState(10);
    const [theme, setTheme] = React.useState<'quantum' | 'classic'>('quantum');
    const [match, setMatch] = React.useState<MatchNotification | null>(null);
    const [liveFeed, setLiveFeed] = React.useState<string[]>([]);
    const [matchHistory, setMatchHistory] = React.useState<MatchHistoryItem[]>([]);

    React.useEffect(() => {
        wsClient.connect();

        // Subscribe to match events
        const unsubMatch = wsClient.subscribe('MATCH_FOUND', (data: any) => {
            console.log('MATCH_FOUND received:', data);
            const price = data.price || 0;
            const dur = data.duration || 30;

            setMatch({
                matchId: data.matchId || data.id,
                price: price,
                duration: dur,
                topic: data.topic || 'Ad Campaign'
            });

            // Add to history
            setMatchHistory(prev => [{
                price: price,
                duration: dur,
                time: new Date().toLocaleTimeString()
            }, ...prev].slice(0, 20));

            setLiveFeed(prev => [`[MATCH] ${data.matchId} @ $${price.toFixed(4)}/s`, ...prev].slice(0, 10));
        });

        // Subscribe to bid events for live feed
        const unsubBid = wsClient.subscribe('bid', (data: any) => {
            const price = data.price || (data.max_price_per_second / 1_000_000);
            setLiveFeed(prev => [`[BID] $${price.toFixed(4)}/s x${data.quantity || 1}`, ...prev].slice(0, 10));
        });

        // Subscribe to ask events for live feed
        const unsubAsk = wsClient.subscribe('ask', (data: any) => {
            const price = data.pricePerSecond ? data.pricePerSecond / 1_000_000 : 0;
            setLiveFeed(prev => [`[ASK] $${price.toFixed(4)}/s`, ...prev].slice(0, 10));
        });

        return () => {
            unsubMatch();
            unsubBid();
            unsubAsk();
        };
    }, []);

    const handleAcceptMatch = () => {
        if (match) {
            console.log('Accepting match:', match.matchId);
            // TODO: Send ACCEPT_MATCH via WebSocket
            setView('human'); // Switch to Focus Portal
            setMatch(null);
        }
    };

    const handleDismissMatch = () => {
        setMatch(null);
    };

    if (view === 'human') {
        return (
            <div className={`h-screen bg-black ${theme}`}>
                <div className="absolute top-0 left-0 p-4 z-50">
                    <button onClick={() => setView('agent')} className="text-gray-500 hover:text-white text-xs uppercase tracking-widest border border-gray-800 px-3 py-1 rounded bg-black/50 backdrop-blur">
                        &larr; Exit Focus Portal
                    </button>
                </div>
                <FocusPortal />
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-screen text-main bg-dark overflow-hidden ${theme}`}>
            <Header setView={setView} theme={theme} setTheme={setTheme} />

            {/* MATCH NOTIFICATION OVERLAY */}
            {match && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-[#0a0a0a] border-2 border-[#00FF41] p-8 rounded-xl max-w-md w-full mx-4 shadow-[0_0_40px_rgba(0,255,65,0.3)]">
                        <div className="text-[#00FF41] text-xs font-bold mb-2 uppercase tracking-widest animate-pulse">Match Found!</div>
                        <h2 className="text-2xl text-white font-bold mb-4">{match.topic}</h2>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-[#111] p-3 rounded">
                                <div className="text-gray-500 text-xs uppercase">Rate</div>
                                <div className="text-xl font-mono text-green-400">${match.price.toFixed(4)}/s</div>
                            </div>
                            <div className="bg-[#111] p-3 rounded">
                                <div className="text-gray-500 text-xs uppercase">Duration</div>
                                <div className="text-xl font-mono text-white">{match.duration}s</div>
                            </div>
                        </div>

                        <div className="bg-[#111] p-3 rounded mb-6">
                            <div className="text-gray-500 text-xs uppercase">Total Earnings</div>
                            <div className="text-2xl font-mono text-green-400">${(match.price * match.duration).toFixed(4)}</div>
                        </div>

                        <button
                            onClick={handleAcceptMatch}
                            className="w-full bg-[#00FF41] text-black font-bold py-4 rounded hover:bg-[#00cc33] transition-colors tracking-widest shadow-[0_0_20px_rgba(0,255,65,0.4)] mb-3"
                        >
                            PAY ATTENTIUM
                        </button>
                        <button
                            onClick={handleDismissMatch}
                            className="w-full bg-transparent text-gray-500 text-xs hover:text-white transition-colors py-2"
                        >
                            DISMISS
                        </button>
                    </div>
                </div>
            )}

            <main className="flex flex-1 w-full overflow-hidden">
                {/* LEFT COLUMN: Campaign Logic */}
                <div className="flex flex-col w-sidebar border-r border-[#333842] bg-panel p-4 gap-4 overflow-y-auto">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Campaign Console</h2>
                    <PlaceBid duration={duration} setDuration={setDuration} />
                    <div className="p-4 border border-dashed border-gray-700 rounded text-center text-gray-500 text-sm">
                        [Escrow Manager Placeholder]
                    </div>
                </div>

                {/* CENTER COLUMN: The Market */}
                <div className="flex-1 flex flex-col min-w-0 bg-dark p-4 gap-4 items-center overflow-y-auto">
                    {/* Live Feed Section */}
                    <div className="w-full max-w-2xl h-[120px] border-b border-[#333842] mb-2 overflow-hidden flex-shrink-0">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Live Match Feed</h2>
                        <div className="text-xs font-mono space-y-1 overflow-y-auto h-[80px]">
                            {liveFeed.length === 0 ? (
                                <div className="text-gray-600">Waiting for events...</div>
                            ) : (
                                liveFeed.map((event, i) => (
                                    <div key={i} className={`${event.includes('[BID]') ? 'text-green-400' : event.includes('[ASK]') ? 'text-red-400' : 'text-yellow-400'}`}>
                                        {event}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Order Book - Limited Height */}
                    <div className="w-full max-w-2xl min-w-[350px] flex-shrink-0" style={{ maxHeight: '400px' }}>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
                            {`<${duration} Second Order Book`}
                        </h2>
                        <div className="h-[350px]">
                            <OrderBook filterDuration={duration} />
                        </div>
                    </div>

                    {/* Recent Matches History */}
                    <div className="w-full max-w-2xl min-w-[350px] mt-4 flex-shrink-0">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Recent Matches</h2>
                        <div className="glass-panel rounded p-4 max-h-[200px] overflow-y-auto">
                            {matchHistory.length === 0 ? (
                                <div className="text-center text-gray-600 text-sm py-4">No matches yet</div>
                            ) : (
                                <div className="space-y-2">
                                    {matchHistory.map((m, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm font-mono border-b border-gray-800 pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-400">${m.price.toFixed(4)}/s</span>
                                                <span className="text-gray-500">×</span>
                                                <span className="text-white">{m.duration}s</span>
                                            </div>
                                            <div className="text-green-400 font-bold">${(m.price * m.duration).toFixed(4)}</div>
                                            <div className="text-gray-600 text-xs">{m.time}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Analytics */}
                <div className="flex flex-col w-analytics border-l border-[#333842] bg-panel p-4 gap-4 overflow-y-auto">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Ask Settings</h2>
                    <PriceFloorSetter duration={duration} setDuration={setDuration} />

                    <div className="p-4 border border-dashed border-gray-700 rounded text-center text-gray-500 text-sm mt-4">
                        [Heatmap Placeholder]
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

export default App;
