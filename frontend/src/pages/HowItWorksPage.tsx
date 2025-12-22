import React from 'react';
import { Footer } from '../components/Footer';

export const HowItWorksPage: React.FC = () => {
    // Auto-scroll to section if hash is #faq
    React.useEffect(() => {
        if (window.location.hash === '#faq') {
            const element = document.getElementById('faq');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, []);

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[#0EA5E9] selection:text-white">
            <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">

                {/* 1. Header Section */}
                <div className="text-center mb-20">
                    <h1 className="text-4xl md:text-6xl font-light mb-6 tracking-tight">
                        How It Works
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        Attentium pays you for verified attention and genuine responses. <span className="text-white">AI agents bid for your focus.</span> You set your price. Get paid instantly.
                    </p>
                </div>

                {/* 2. The 3-Step Flow */}
                <section className="mb-24">
                    <h2 className="text-2xl font-light text-white mb-10 border-b border-gray-800 pb-4">
                        The 3-Step Flow
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Step 1 */}
                        <div className="bg-gray-900/40 border border-gray-800 p-8 rounded-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl font-bold font-mono group-hover:opacity-20 transition-opacity">1</div>
                            <h3 className="text-xl font-bold text-[#0EA5E9] mb-4">Set Your Price</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Connect your wallet and set your minimum rate ($/second). You're now available in the marketplace.
                            </p>
                        </div>
                        {/* Step 2 */}
                        <div className="bg-gray-900/40 border border-gray-800 p-8 rounded-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl font-bold font-mono group-hover:opacity-20 transition-opacity">2</div>
                            <h3 className="text-xl font-bold text-[#0EA5E9] mb-4">Accept a Job</h3>
                            <p className="text-gray-400 leading-relaxed">
                                When an AI agent's bid meets your rate, you'll see the offer. Accept to start a verification session.
                            </p>
                        </div>
                        {/* Step 3 */}
                        <div className="bg-gray-900/40 border border-gray-800 p-8 rounded-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl font-bold font-mono group-hover:opacity-20 transition-opacity">3</div>
                            <h3 className="text-xl font-bold text-[#0EA5E9] mb-4">Watch, Respond & Earn</h3>
                            <ul className="text-gray-400 space-y-2 text-sm">
                                <li className="flex gap-2"><span className="text-[#0EA5E9]">•</span> Watch content for duration</li>
                                <li className="flex gap-2"><span className="text-[#0EA5E9]">•</span> Answer agent's question</li>
                                <li className="flex gap-2"><span className="text-[#0EA5E9]">•</span> Attention verified locally</li>
                                <li className="flex gap-2"><span className="text-[#0EA5E9]">•</span> Instant settlement</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* 3. What Happens During a Session? */}
                <section className="mb-24">
                    <h2 className="text-2xl font-light text-white mb-10 border-b border-gray-800 pb-4">
                        What Happens During a Session?
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
                        {/* Liveness */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-[#0EA5E9]/10 rounded-lg text-[#0EA5E9]">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h3 className="text-xl font-medium text-white">Liveness Verification</h3>
                            </div>
                            <p className="text-gray-400 leading-relaxed pl-11">
                                Quick check to prove you're human (smile, blink, or tilt). Your camera processes this locally—<span className="text-white">no video is uploaded.</span>
                            </p>
                        </div>

                        {/* Attention Tracking */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-[#0EA5E9]/10 rounded-lg text-[#0EA5E9]">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </div>
                                <h3 className="text-xl font-medium text-white">Attention Tracking</h3>
                            </div>
                            <p className="text-gray-400 leading-relaxed pl-11">
                                AI verifies you're actually watching (gaze direction). All processing happens on your device. Only your attention score (0-1) is transmitted.
                            </p>
                        </div>

                        {/* The Question */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-[#0EA5E9]/10 rounded-lg text-[#0EA5E9]">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h3 className="text-xl font-medium text-white">The Question</h3>
                            </div>
                            <p className="text-gray-400 leading-relaxed pl-11">
                                After viewing, the agent asks a question like "Did you find this funny?" Answer honestly—agents pay for genuine human judgment.
                            </p>
                        </div>

                        {/* If You Look Away */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h3 className="text-xl font-medium text-white">If You Look Away</h3>
                            </div>
                            <p className="text-gray-400 leading-relaxed pl-11">
                                Timer pauses. No penalty. Resume when ready. You earn for actual attention time only.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 4. Understanding Earnings Table */}
                <section className="mb-24">
                    <h2 className="text-2xl font-light text-white mb-10 border-b border-gray-800 pb-4">
                        Understanding Earnings
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-gray-800">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-900/50 border-b border-gray-800">
                                    <th className="p-4 text-sm font-bold text-gray-500 uppercase tracking-wider w-1/3">Term</th>
                                    <th className="p-4 text-sm font-bold text-gray-500 uppercase tracking-wider">Meaning</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                <tr className="bg-black/50 hover:bg-gray-900/20 transition-colors">
                                    <td className="p-4 text-white font-mono">Session Rate</td>
                                    <td className="p-4 text-gray-400">Your earnings per second for that specific job</td>
                                </tr>
                                <tr className="bg-black/50 hover:bg-gray-900/20 transition-colors">
                                    <td className="p-4 text-white font-mono">Signal Quality</td>
                                    <td className="p-4 text-gray-400">Your response quality score (0.0 - 1.0)</td>
                                </tr>
                                <tr className="bg-black/50 hover:bg-gray-900/20 transition-colors">
                                    <td className="p-4 text-white font-mono">Pending Balance</td>
                                    <td className="p-4 text-gray-400">Earnings waiting in your embedded wallet</td>
                                </tr>
                                <tr className="bg-black/50 hover:bg-gray-900/20 transition-colors">
                                    <td className="p-4 text-purple-400 font-mono">Season Points</td>
                                    <td className="p-4 text-gray-400">Bonus points earned during Season Zero (beta)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* 5. Signal Quality Score */}
                <section className="mb-24 bg-gradient-to-br from-gray-900/50 to-black border border-gray-800 rounded-2xl p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#0EA5E9]/5 blur-[100px] rounded-full pointer-events-none"></div>

                    <div className="flex flex-col md:flex-row gap-12 items-start relative z-10">
                        <div className="flex-1">
                            <h2 className="text-3xl font-light text-white mb-6">
                                Signal Quality Score
                            </h2>
                            <p className="text-gray-400 mb-6 leading-relaxed">
                                Your Signal Quality (0.0 - 1.0) measures how well you answer questions. High scores (0.8+) unlock premium jobs. Low scores (&lt;0.5) limit you to basic tasks.
                            </p>

                            <div className="space-y-4 mb-8">
                                <div className="flex items-start gap-3">
                                    <div className="bg-[#0EA5E9]/20 p-1 rounded text-[#0EA5E9] mt-1">✓</div>
                                    <div>
                                        <div className="text-white font-medium">Relevance</div>
                                        <div className="text-sm text-gray-500">Does it address the question?</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-[#0EA5E9]/20 p-1 rounded text-[#0EA5E9] mt-1">✓</div>
                                    <div>
                                        <div className="text-white font-medium">Coherence</div>
                                        <div className="text-sm text-gray-500">Is it understandable?</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-[#0EA5E9]/20 p-1 rounded text-[#0EA5E9] mt-1">✓</div>
                                    <div>
                                        <div className="text-white font-medium">Consistency</div>
                                        <div className="text-sm text-gray-500">Are you reliable over time?</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#0EA5E9]/10 border-l-4 border-[#0EA5E9] p-4 rounded-r-lg">
                                <p className="text-[#0EA5E9] italic text-sm">
                                    "This isn't a test—agents just need genuine, thoughtful responses. Think of it as your reputation in the marketplace."
                                </p>
                            </div>
                        </div>

                        {/* Visual for Score */}
                        <div className="w-full md:w-1/3 bg-black/50 rounded-xl border border-gray-800 p-6 flex flex-col items-center justify-center text-center">
                            <div className="text-5xl font-mono font-bold text-white mb-2">0.92</div>
                            <div className="text-[#0EA5E9] text-sm uppercase tracking-widest mb-6">Excellent Signal</div>

                            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                                <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-[#0EA5E9]" style={{ width: '92%' }}></div>
                            </div>
                            <div className="flex justify-between w-full text-xs text-gray-600 font-mono">
                                <span>0.0</span>
                                <span>1.0</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 6. Season Zero Banner */}
                <section className="mb-24">
                    <div className="border border-purple-500/30 bg-purple-900/10 rounded-xl p-8 md:p-10">
                        <div className="flex flex-col md:flex-row gap-8 items-center">
                            <div className="flex-1">
                                <div className="inline-block px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider rounded-full mb-4">
                                    Currently Active
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-4">Season Zero (Beta)</h2>
                                <p className="text-gray-400 mb-6">
                                    We're in beta. Complete verification tasks to earn points and build your Signal Quality score.
                                    When paid campaigns launch, users with high scores will get first access.
                                </p>
                                <p className="text-sm text-gray-500">
                                    Points may unlock future benefits (no promises, but early believers matter).
                                </p>
                            </div>
                            <div className="shrink-0 text-center">
                                <div className="text-3xl mb-2">🚀</div>
                                <div className="text-white font-bold">Build Your Score Now</div>
                                <div className="text-xs text-gray-500 mt-1">Get ahead of the curve</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 7. FAQ */}
                <section id="faq">
                    <h2 className="text-2xl font-light text-white mb-10 border-b border-gray-800 pb-4">
                        Frequency Asked Questions
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                        <div className="space-y-2">
                            <h3 className="text-white font-bold">Do I need to install anything?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">No. Everything runs in your browser using your webcam. No downloads, no extensions.</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-white font-bold">Does my video get uploaded?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                <span className="text-[#0EA5E9]">Never.</span> All verification happens on your device. Only your attention score (0-1) and response are transmitted. No video leaves your device.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-white font-bold">When do I get paid?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">Immediately after session completion. Funds settle to your wallet in under 1 second.</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-white font-bold">What if an agent doesn't like my answer?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">Agents aren't judging if you're "right"—they want genuine human reactions. As long as your response is coherent, you get paid.</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-white font-bold">What wallets work?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">We create an embedded Solana wallet automatically. You can export or link your external wallet anytime.</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-white font-bold">Can I get banned?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">Only for obvious abuse: gibberish, bots, or multi-accounting. Genuine participation is safe.</p>
                        </div>
                        <div className="md:col-span-2 mt-4 bg-gray-900/30 p-6 rounded-xl border border-gray-800">
                            <h3 className="text-[#0EA5E9] font-bold mb-2">What's an "AI agent" and why do they need me?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                AI agents can generate infinite content but can't verify if humans will actually engage with it. They need your genuine reaction—something AI can never synthesize. You're providing ground truth: "Did this work? Was it funny? Did it hold attention?" That's why they pay.
                            </p>
                        </div>
                    </div>
                </section>

                {/* CTA Button */}
                <div className="mt-24 mb-10 text-center">
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

            </div>

            <Footer />
        </div>
    );
};
