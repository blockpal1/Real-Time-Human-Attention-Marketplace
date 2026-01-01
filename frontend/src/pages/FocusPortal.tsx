import { useState, useEffect } from 'react';
import { useAttentionAI } from '../hooks/useAttentionAI';

type PortalState = 'LOBBY' | 'SCANNING' | 'OFFER' | 'ACTIVE' | 'QA';

interface FocusPortalProps {
    initialMatch?: any;
    initialToken?: string | null;
}

export default function FocusPortal({ initialMatch, initialToken }: FocusPortalProps) {
    // State
    const [state, setState] = useState<PortalState>(initialMatch ? 'ACTIVE' : 'LOBBY');
    const [statusText, setStatusText] = useState("Initializing...");
    const [match, setMatch] = useState<any>(initialMatch || null);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [balance, setBalance] = useState(0.0000);
    // Use active state to control when attention tracking runs
    const isTrackingActive = state === 'ACTIVE';

    // Logic - useAttentionAI requires an `active` boolean parameter
    const { videoRef, isAttentive, status } = useAttentionAI(isTrackingActive);
    const permissionGranted = status === 'ready';
    const error = status === 'error' ? 'Failed to initialize attention tracking' : null;

    // Web 2.5 State
    const [countdown, setCountdown] = useState(30);
    const [sessionToken] = useState<string | null>(initialToken || null);

    // Mock Auth for Verification (Unused for now)
    // const user = { wallet: { address: 'test-user-wallet-123' } };

    // WebSocket Connection
    useEffect(() => {
        if (!permissionGranted || !sessionToken) return;

        // Connect only when we have permission (User is "Online")
        const socket = new WebSocket('ws://localhost:3000/ws/events');

        socket.onopen = () => {
            console.log('Connected to Focus Grid');
            setState('SCANNING');
            setStatusText("Scanning for Neural Tasks...");
            // Auth with Real Token
            socket.send(JSON.stringify({ type: 'AUTH', token: sessionToken }));
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'MATCH_FOUND') {
                setMatch(msg.payload);
                setCountdown(29); // Start countdown
                setState('OFFER');
            }
        };

        socket.onclose = () => {
            console.log('Focus Grid Disconnected');
            if (state !== 'LOBBY') {
                setState('LOBBY');
                setStatusText("Connection Lost. Reconnecting...");
            }
        };

        setWs(socket);

        return () => {
            socket.close();
        };
    }, [permissionGranted, sessionToken, state]);


    // Verification Loop (Simulation)
    useEffect(() => {
        if (state === 'ACTIVE' && ws && isAttentive) {
            // Stream 'Proof of Attention' every second
            const interval = setInterval(() => {
                ws.send(JSON.stringify({
                    type: 'ATTENTION_PROOF',
                    payload: { score: 1.0, timestamp: Date.now() }
                }));
                setBalance(b => b + 0.0001); // Local optimistic update
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [state, ws, isAttentive]);

    // Handshake Timer
    useEffect(() => {
        if (state !== 'OFFER') return;
        if (countdown <= 0) {
            // Timeout - Auto Reject
            setMatch(null);
            setState('SCANNING'); // Or Lobby
            return;
        }
        const timer = setInterval(() => setCountdown(c => c - 1), 1000);
        return () => clearInterval(timer);
    }, [state, countdown]);

    // Handlers
    const handleAccept = () => {
        if (ws && match) {
            ws.send(JSON.stringify({ type: 'ACCEPT_MATCH', matchId: match.id }));
            setState('ACTIVE');
        }
    };

    const handleQASubmit = (answer: string) => {
        if (ws && match) {
            ws.send(JSON.stringify({ type: 'SUBMIT_QA', matchId: match.id, answer }));
            setState('SCANNING');
            setMatch(null);
            setBalance(b => b + (match.price * match.duration)); // Full reward
        }
    };
    // --- RENDER ---

    return (
        <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-main)] font-mono flex flex-col items-center justify-center p-4 relative overflow-hidden">

            {/* Background Grid */}
            <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none"></div>

            {/* Hidden Camera Feed (Used for AI) */}
            <video
                ref={videoRef}
                className="absolute top-4 right-4 w-32 h-24 border border-green-900 rounded opacity-50 hover:opacity-100 transition-opacity z-50"
                autoPlay
                muted
                playsInline
            />
            {isAttentive && permissionGranted && (
                <div className="absolute top-4 right-4 w-32 h-24 border-2 border-[#00FF41] rounded pointer-events-none animate-pulse"></div>
            )}

            {/* Error Overlay */}
            {error && (
                <div className="absolute top-0 left-0 w-full bg-red-900/80 p-2 text-center text-red-200 text-xs">
                    SYSTEM ERROR: {error}
                </div>
            )}

            {/* --- LOBBY STATE --- */}
            {state === 'LOBBY' && (
                <div className="bg-[var(--bg-glass)] border border-[var(--border-neon)] p-8 rounded-lg max-w-md w-full text-center shadow-[var(--shadow-neon)] backdrop-blur-md">
                    <h1 className="text-3xl font-bold mb-2 tracking-tighter text-[var(--primary-neon)] shadow-green-glow animate-pulse">
                        FOCUS PORTAL
                    </h1>
                    <p className="text-[var(--text-secondary)] mb-8 text-sm">Monetize your attention securely.</p>

                    {!permissionGranted ? (
                        <div className="text-yellow-500 text-sm mb-4 animate-bounce">
                            Waiting for Camera Access...<br />
                            <span className="text-xs text-[var(--text-secondary)]">(Required for verification)</span>
                        </div>
                    ) : (
                        <button
                            onClick={() => setState('SCANNING')}
                            className="w-full bg-green-500 text-black font-bold py-3 rounded mt-6 hover:bg-green-400 shadow-green-glow"
                        >
                            ACTIVATE NEURAL LINK
                        </button>
                    )}
                </div>
            )}

            {/* --- SCANNING STATE --- */}
            {state === 'SCANNING' && (
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-2 border-green-500 animate-ping absolute opacity-50"></div>
                        <div className="w-16 h-16 rounded-full bg-green-500 shadow-green-glow flex items-center justify-center text-black font-bold text-2xl">
                            👁️
                        </div>
                    </div>
                    <div className="text-green-500 animate-pulse tracking-widest text-sm uppercase">
                        {statusText}
                    </div>
                    <div className="text-gray-600 text-xs mt-8">
                        Session Earnings: <span className="text-white">${balance.toFixed(4)} USDC</span>
                    </div>
                </div>
            )}

            {/* --- OFFER STATE --- */}
            {state === 'OFFER' && match && (
                <div className="bg-[#0a0a0a] border border-[#00FF41] p-8 rounded-xl max-w-lg w-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 bg-[#00FF41] transition-all duration-1000 ease-linear" style={{ width: `${(countdown / 30) * 100}%` }}></div>

                    <h2 className="text-xl text-white mb-1">Match Found!</h2>
                    <h3 className="text-2xl text-[#00FF41] font-bold mb-2">{match.topic || 'Unknown Content'}</h3>
                    <div className="text-red-500 font-mono text-sm mb-6 animate-pulse">Expires in {countdown}s</div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-[#111] p-3 rounded">
                            <div className="text-gray-500 text-xs">EARNINGS</div>
                            <div className="text-xl font-mono">${(match.price * match.duration).toFixed(4)}</div>
                        </div>
                        <div className="bg-[#111] p-3 rounded">
                            <div className="text-gray-500 text-xs">DURATION</div>
                            <div className="text-xl font-mono">{match.duration}s</div>
                        </div>
                    </div>

                    <button
                        onClick={handleAccept}
                        className="w-full bg-[#00FF41] text-black font-bold py-4 rounded hover:bg-[#00cc33] transition-colors tracking-widest shadow-[0_0_20px_rgba(0,255,65,0.4)]"
                    >
                        PAY ATTENTIUM
                    </button>
                    <button
                        onClick={() => setState('SCANNING')}
                        className="w-full mt-3 bg-transparent text-gray-500 text-xs hover:text-white transition-colors"
                    >
                        REJECT MATCH
                    </button>
                </div>
            )}

            {/* --- ACTIVE STATE --- */}
            {state === 'ACTIVE' && (
                <div className="w-full max-w-4xl aspect-video bg-black border border-gray-800 relative shadow-2xl">
                    {/* ATTENTION INDICATOR */}
                    <div className={`absolute top-0 left-0 w-full h-1 transition-colors duration-300 ${isAttentive ? 'bg-[#00FF41] shadow-[0_0_10px_#00FF41]' : 'bg-red-500 shadow-[0_0_10px_red]'}`}></div>

                    {/* CONTENT SIMULATION */}
                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                        {/* In real app, iframe or video tag here */}
                        <div className="text-center">
                            <h2 className="text-white text-lg mb-4">Watching Content...</h2>
                            {/* FAKE VIDEO PROGRESS */}
                            <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden mx-auto">
                                <div className="h-full bg-white animate-[width_10s_linear]"></div>
                            </div>

                            <button
                                className="mt-8 text-xs text-gray-600 border border-gray-800 px-3 py-1 rounded hover:bg-gray-800"
                                onClick={() => setState('QA')}
                            >
                                [DEV: Skip to End]
                            </button>
                        </div>
                    </div>

                    {/* WARNING OVERLAY */}
                    {!isAttentive && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 backdrop-blur-sm">
                            <div className="text-red-500 font-bold border-2 border-red-500 p-4 rounded bg-black">
                                ⚠️ ATTENTION LOST<br />
                                <span className="text-xs text-red-300 font-normal">Please focus on the content to resume earning.</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- QA STATE --- */}
            {state === 'QA' && (
                <div className="bg-[#0a0a0a] border border-[#00FF41] p-8 rounded-xl max-w-lg w-full text-center">
                    <div className="text-[#00FF41] text-xs font-bold mb-4 uppercase tracking-widest">Verification Required</div>
                    <h3 className="text-xl text-white mb-8">
                        {match?.validation_question || "Did the brand logo appear in the first 5 seconds?"}
                    </h3>

                    <div className="flex gap-4">
                        <button
                            onClick={() => handleQASubmit('yes')}
                            className="flex-1 bg-gray-800 hover:bg-[#00FF41] hover:text-black border border-gray-700 text-white py-3 rounded transition-all"
                        >
                            YES
                        </button>
                        <button
                            onClick={() => handleQASubmit('no')}
                            className="flex-1 bg-gray-800 hover:bg-red-500 border border-gray-700 text-white py-3 rounded transition-all"
                        >
                            NO
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
