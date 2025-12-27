import React from 'react';

/**
 * HowItWorks - 3-step process section
 */
export const HowItWorks: React.FC = () => {
    const steps = [
        {
            icon: (
                <svg className="w-12 h-12 text-[#0EA5E9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            title: "Set Your Price",
            subtitle: "$0.01 - $1.00 per second"
        },
        {
            icon: (
                <svg className="w-12 h-12 text-[#0EA5E9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            ),
            title: "Match & Signal",
            subtitle: "AI agent bids, you watch"
        },
        {
            icon: (
                <svg className="w-12 h-12 text-[#0EA5E9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            ),
            title: "Get Paid",
            subtitle: "USDC settles in <400ms"
        }
    ];

    return (
        <section className="bg-black py-24 px-6">
            <div className="max-w-5xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-light text-white text-center mb-20">
                    How It Works
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
                    {steps.map((step, index) => (
                        <div key={index} className="flex flex-col items-center text-center">
                            <div className="mb-6">
                                {step.icon}
                            </div>
                            <h3 className="text-xl font-medium text-white mb-2">
                                {step.title}
                            </h3>
                            <p className="text-gray-500 text-sm">
                                {step.subtitle}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

/**
 * PrivacyGuarantee - Privacy is architecture section
 */
export const PrivacyGuarantee: React.FC = () => {
    const dataFlow = [
        { text: "Camera captures gaze", result: "Never sent", icon: "❌", negative: true },
        { text: "AI scores attention", result: "Only this", icon: "✓", negative: false },
        { text: "Proof generated", result: "And this", icon: "✓", negative: false },
        { text: "Payment received", result: "Cha-Ching!", icon: "✓", negative: false }
    ];

    return (
        <section className="bg-black py-24 px-6 border-t border-gray-900">
            <div className="max-w-5xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-light text-white text-center mb-16">
                    Your Privacy Is Architecture, Not Policy
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    {/* Left: Your Device */}
                    <div className="bg-gray-900/30 rounded-lg p-8 border border-gray-800">
                        <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#0EA5E9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Your Device
                        </h3>
                        <div className="space-y-4">
                            {dataFlow.map((item, index) => (
                                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                                    <span className="text-gray-400">{item.text}</span>
                                    <span className={`flex items-center gap-2 ${item.negative ? 'text-red-400' : 'text-[#0EA5E9]'}`}>
                                        <span>{item.icon}</span>
                                        <span className="text-sm">{item.result}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Explanation */}
                    <div className="flex items-center">
                        <p className="text-gray-400 text-lg leading-relaxed">
                            Your camera footage is processed locally. Not a single frame leaves your device.
                            The network only sees: a cryptographic proof of attention (0-1 score) and your wallet address.
                            <span className="block mt-4 text-gray-500">
                                We can't see you. AI agents can't see you. No one can.
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

/**
 * FinalCTA - Final call-to-action section
 */
export const FinalCTA: React.FC = () => {
    return (
        <section className="bg-black py-32 px-6">
            <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-4xl md:text-5xl font-light text-white mb-12">
                    Time to Initialize Economic Link
                </h2>

                {/* CTA Button */}
                <div className="mb-10">
                    <div className="relative inline-block group">
                        <div
                            className="absolute -inset-[2px] rounded-full opacity-100"
                            style={{
                                background: 'conic-gradient(from var(--angle), transparent 0%, transparent 70%, #0EA5E9 85%, transparent 100%)',
                                animation: 'spin 6s linear infinite',
                                filter: 'blur(1px)',
                            }}
                        />
                        <div
                            className="absolute -inset-[2px] rounded-full"
                            style={{
                                background: 'conic-gradient(from var(--angle), transparent 0%, transparent 75%, #0EA5E9 87%, #38BDF8 93%, transparent 100%)',
                                animation: 'spin 6s linear infinite',
                            }}
                        />
                        <button
                            className="relative rounded-full bg-black hover:bg-gray-900 transition-colors"
                            onClick={() => window.location.hash = '#app'}
                            style={{
                                padding: '24px 64px',
                                border: '2px solid #444',
                                backgroundColor: '#000',
                                color: 'white',
                                fontFamily: 'monospace',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                            }}
                        >
                            Initialize Link
                        </button>
                        <style>{`
                            @property --angle {
                                syntax: '<angle>';
                                initial-value: 0deg;
                                inherits: false;
                            }
                            @keyframes spin {
                                from { --angle: 0deg; }
                                to { --angle: 360deg; }
                            }
                        `}</style>
                    </div>
                </div>

                {/* Benefits */}
                <p className="text-gray-400 max-w-2xl mx-auto">
                    Attentium is strictly non-custodial. Your earnings go directly to your wallet.
                    We confirm you are a real human on a verified device.
                </p>
                <p className="text-gray-600 text-xs">
                    No installation required • 2 minutes to first settlement
                </p>
            </div>
        </section>
    );
};
