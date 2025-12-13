import React from 'react';

type PanelType = 'bid' | 'book' | 'ask';

interface MobileNavProps {
    activePanel: PanelType;
    setActivePanel: (panel: PanelType) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activePanel, setActivePanel }) => {
    const tabs: { id: PanelType; label: string; color: string }[] = [
        { id: 'bid', label: 'Bid', color: '#0EA5E9' },
        { id: 'book', label: 'Book', color: '#9CA3AF' },
        { id: 'ask', label: 'Ask', color: '#FFFFFF' },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a] border-t border-[#333842] safe-area-pb">
            <div className="flex justify-around items-center h-16">
                {tabs.map((tab) => {
                    const isActive = activePanel === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActivePanel(tab.id)}
                            className={`flex-1 flex flex-col items-center justify-center h-full transition-all ${isActive ? 'opacity-100' : 'opacity-50'
                                }`}
                            style={{
                                color: isActive ? tab.color : '#6B7280',
                            }}
                        >
                            {/* Icon placeholder - simple shapes */}
                            <div
                                className={`w-6 h-6 rounded mb-1 flex items-center justify-center text-xs font-bold transition-all ${isActive ? 'scale-110' : 'scale-100'
                                    }`}
                                style={{
                                    backgroundColor: isActive ? `${tab.color}20` : 'transparent',
                                    border: `1px solid ${isActive ? tab.color : 'transparent'}`,
                                }}
                            >
                                {tab.id === 'bid' && '📊'}
                                {tab.id === 'book' && '📖'}
                                {tab.id === 'ask' && '💰'}
                            </div>
                            <span className="text-xs font-medium uppercase tracking-wider">
                                {tab.label}
                            </span>
                            {/* Active indicator line */}
                            {isActive && (
                                <div
                                    className="absolute bottom-0 h-0.5 w-12 rounded-full"
                                    style={{ backgroundColor: tab.color }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
