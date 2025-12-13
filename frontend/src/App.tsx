import React from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { OrderBook } from './components/OrderBook';
import { PriceFloorSetter } from './components/PriceFloorSetter';
import { PlaceBid } from './components/PlaceBid';
import { wsClient } from './services/wsClient';
import { api } from './services/api';
import { MatchNotificationModal } from './components/MatchNotificationModal';
import { CampaignAnalytics } from './components/CampaignAnalytics';
import { HeroSection, ManifestoSection, HowItWorks, PrivacyGuarantee, FinalCTA, LandingFooter } from './components';
import { MobileNav } from './components/MobileNav';

interface MatchNotification {
    matchId: string;
    price: number;
    duration: number;
    topic?: string;
    contentUrl?: string | null;
    validationQuestion?: string | null;
}

function App() {
    const [duration, setDuration] = React.useState(10);
    const [theme, setTheme] = React.useState<'quantum' | 'classic'>('quantum');
    const [match, setMatch] = React.useState<MatchNotification | null>(null);
    const [liveFeed, setLiveFeed] = React.useState<string[]>([]);
    const [sessionToken, setSessionToken] = React.useState<string | null>(null);
    const [userPubkey, setUserPubkey] = React.useState<string | null>(null);
    const [showAnalytics, setShowAnalytics] = React.useState(false);
    const [showLanding, setShowLanding] = React.useState(true);
    const [activePanel, setActivePanel] = React.useState<'bid' | 'book' | 'ask'>('book');

    // Listen for hash changes to show analytics or landing
    React.useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            setShowAnalytics(hash === '#analytics');
            // Show landing page if no hash, #landing, or on initial load
            setShowLanding(hash === '' || hash === '#landing' || hash === '#');
        };
        handleHashChange(); // Check initial hash
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    React.useEffect(() => {
        // Connect if not already connected (handled by wsClient internal check)
        wsClient.connect();

        // Subscribe to match events
        const unsubMatch = wsClient.subscribe('MATCH_FOUND', (data: any) => {
            console.log('MATCH_FOUND received:', data);

            setMatch({
                matchId: data.matchId || data.id,
                price: data.price || 0,
                duration: data.duration || 30,
                topic: (typeof data.topic === 'string' ? data.topic : 'Ad Campaign'),
                contentUrl: data.contentUrl || null,
                validationQuestion: data.validationQuestion || null
            });

            const topicStr = typeof data.topic === 'string' ? data.topic : 'Campaign';
            setLiveFeed(prev => [`[MATCH] ${topicStr} @ $${(data.price || 0).toFixed(4)}/s`, ...prev].slice(0, 10));
        });

        return () => {
            unsubMatch();
        };
    }, []);

    // Authenticate WS when session token changes (User places Ask/Start Session)
    React.useEffect(() => {
        if (sessionToken) {
            console.log("Authenticating WS with token...");
            wsClient.send({ type: 'AUTH', token: sessionToken });
        }
    }, [sessionToken]);

    // Called when user finishes focus session (either completes or exits)
    const handleAcceptMatch = () => {
        // Session ended - just clear the match to dismiss the modal
        setMatch(null);
        console.log('Focus session ended');
    };

    const handleDismissMatch = async () => {
        // Notify backend to restore bid to order book
        if (match?.matchId) {
            try {
                await api.dismissMatch(match.matchId);
                console.log('Match dismissed, bid returned to order book');
            } catch (error) {
                console.error('Failed to dismiss match:', error);
            }
        }
        setMatch(null);
    };

    return (
        <>
            {/* Landing Page */}
            {showLanding && (
                <div className="h-screen overflow-y-scroll bg-black">
                    <HeroSection />
                    <ManifestoSection />
                    <HowItWorks />
                    <PrivacyGuarantee />
                    <FinalCTA />
                    <LandingFooter />
                </div>
            )}

            {/* Main App Dashboard */}
            {!showLanding && (
                <div className={`flex flex-col h-screen text-main bg-dark overflow-hidden ${theme}`}>
                    <Header theme={theme} setTheme={setTheme} userPubkey={userPubkey} />

                    {/* MATCH NOTIFICATION OVERLAY */}
                    {match && (
                        <MatchNotificationModal
                            match={match}
                            onAccept={handleAcceptMatch}
                            onDismiss={handleDismissMatch}
                        />
                    )}

                    <main className="flex flex-col md:flex-row flex-1 w-full overflow-hidden">
                        {/* LEFT COLUMN: Campaign Logic or Analytics */}
                        <div className={`panel-left bg-panel p-4 gap-4 overflow-y-auto pb-20 md:pb-4 ${activePanel === 'bid' ? 'active' : ''}`}>
                            {showAnalytics ? (
                                <>
                                    <button
                                        onClick={() => window.location.hash = '#app'}
                                        className="text-left text-sm text-gray-400 hover:text-white transition-colors mb-2"
                                    >
                                        ← Back to Campaign Console
                                    </button>
                                    <CampaignAnalytics agentPubkey="mock-agent-pubkey" />
                                </>
                            ) : (
                                <>
                                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Campaign Console</h2>
                                    <PlaceBid duration={duration} setDuration={setDuration} />
                                    <div className="p-4 border border-dashed border-gray-700 rounded text-center text-gray-500 text-sm">
                                        [Escrow Manager Placeholder]
                                    </div>
                                </>
                            )}
                        </div>

                        {/* CENTER COLUMN: The Market */}
                        <div className={`panel-center bg-dark p-4 gap-4 items-center overflow-y-auto pb-20 md:pb-4 ${activePanel === 'book' ? 'active' : ''}`}>
                            {/* Live Feed Section */}
                            <div className="w-full max-w-2xl h-[120px] border-b border-[#333842] mb-2 overflow-hidden flex-shrink-0">
                                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Live Match Feed</h2>
                                <div className="text-xs font-mono space-y-1 overflow-y-auto h-[80px]">
                                    {liveFeed.length === 0 ? (
                                        <div className="text-gray-600">Waiting for events...</div>
                                    ) : (
                                        liveFeed.map((event, i) => (
                                            <div key={i} className={`${event.includes('[BID]') ? 'text-[#0EA5E9]' : event.includes('[ASK]') ? 'text-white' : 'text-yellow-400'}`}>
                                                {event}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Order Book */}
                            <div className="flex-1 flex flex-col overflow-hidden w-full max-w-2xl min-w-0 md:min-w-[350px]">
                                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    {`<${duration} Second Order Book`}
                                </h2>
                                <OrderBook filterDuration={duration} />
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Ask Settings */}
                        <div className={`panel-right bg-panel p-4 gap-4 overflow-y-auto pb-20 md:pb-4 ${activePanel === 'ask' ? 'active' : ''}`}>
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Ask Settings</h2>
                            <PriceFloorSetter duration={duration} setDuration={setDuration} setSessionToken={setSessionToken} setUserPubkey={setUserPubkey} />

                            <div className="p-4 border border-dashed border-gray-700 rounded text-center text-gray-500 text-sm mt-4">
                                [Heatmap Placeholder]
                            </div>
                        </div>
                    </main>

                    {/* Mobile Navigation */}
                    <MobileNav activePanel={activePanel} setActivePanel={setActivePanel} />

                    <Footer />
                </div>
            )}
        </>
    );
}

export default App;
