import React from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { OrderBook } from './components/OrderBook';
// import { FiltersSidebar } from './components/FiltersSidebar';
import { EngagementPreview } from './components/EngagementPreview';
import { PriceFloorSetter } from './components/PriceFloorSetter';
import { PlaceBid } from './components/PlaceBid';
import { wsClient } from './services/wsClient';
import FocusPortal from './pages/FocusPortal';

function App() {
    const [view, setView] = React.useState<'agent' | 'human'>('agent');
    const [duration, setDuration] = React.useState(10); // Restore duration state

    React.useEffect(() => {
        wsClient.connect();
    }, []);

    if (view === 'human') {
        return (
            <div className="h-screen bg-black">
                {/* Minimal Header for Focus Mode */}
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
        <div className="flex flex-col h-screen text-main bg-dark overflow-hidden">
            <Header setView={setView} />

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
                <div className="flex-1 flex flex-col min-w-0 bg-dark p-4 gap-4 items-center">
                    {/* Live Feed Section */}
                    <div className="w-full max-w-2xl h-[150px] border-b border-[#333842] mb-4">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Live Match Feed</h2>
                        <div className="text-xs text-neon font-mono">
                            Waiting for events...
                        </div>
                    </div>

                    {/* Order Book */}
                    <div className="flex-1 flex flex-col overflow-hidden w-full max-w-2xl min-w-[350px]">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
                            {`<${duration} Second Order Book`}
                        </h2>
                        <OrderBook filterDuration={duration} />
                    </div>
                </div>

                {/* RIGHT COLUMN: Analytics */}
                <div className="flex flex-col w-analytics border-l border-[#333842] bg-panel p-4 gap-4 overflow-y-auto">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Market Analytics</h2>
                    <EngagementPreview />
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
