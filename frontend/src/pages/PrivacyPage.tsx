import React from 'react';
import { Footer } from '../components/Footer';

export const PrivacyPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[#0EA5E9] selection:text-white">
            <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">

                {/* 1. Header Section */}
                <div className="text-center mb-20">
                    <h1 className="text-4xl md:text-6xl font-light mb-6 tracking-tight">
                        Privacy as Architecture
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        We prove your attention to AI agents without exposing your identity. <span className="text-white">Verification is cryptographic, not visual.</span>
                    </p>
                </div>

                {/* 2. The Blind Verification Guarantee */}
                <section className="mb-24">
                    <div className="bg-gray-900/40 border border-gray-800 p-8 md:p-12 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                            <svg className="w-64 h-64 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-light text-white mb-6">The Privacy Promise</h2>
                        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
                            Attentium uses a <strong>Blind Verification Protocol</strong> to validate your attention. This allows AI agents to confirm you watched their content without ever accessing your camera feed or personal data.
                            We verify that <span className="text-white font-bold">you</span> paid attention, without revealing who <span className="text-white font-bold">you</span> are.
                        </p>
                    </div>
                </section>

                {/* 3. Mandatory Verification */}
                <section className="mb-24">
                    <h2 className="text-2xl font-light text-white mb-10 border-b border-gray-800 pb-4">
                        Verification Protocols
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div>
                            <h3 className="text-xl font-bold text-[#0EA5E9] mb-4 flex items-center gap-2">
                                <span className="bg-[#0EA5E9]/10 p-1 rounded">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </span>
                                Camera Access is Mandatory
                            </h3>
                            <p className="text-gray-400 leading-relaxed">
                                To participate in the attention economy, verification is non-negotiable. Agents pay for <em>verified</em> human attention. No camera means no verification, and no value exchange.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <span className="bg-white/10 p-1 rounded">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                </span>
                                Local-First Processing
                            </h3>
                            <p className="text-gray-400 leading-relaxed">
                                Video streams are processed <strong>locally on your device</strong> using TensorFlow.js. Only the <em>proof</em> of attention (a mathematical hash) leaves your machine. The video feed is never uploaded.
                            </p>
                        </div>
                    </div>

                    {/* Diagram */}
                    <div className="mt-12 p-8 bg-black border border-dashed border-gray-800 rounded-xl flex flex-col md:flex-row items-center justify-between text-center gap-4 text-sm font-mono text-gray-500">
                        <div className="p-4 border border-gray-700 rounded bg-gray-900 text-white w-full md:w-auto">Your Camera</div>
                        <div className="text-[#0EA5E9]">→ Raw Video Stream →</div>
                        <div className="p-4 border border-[#0EA5E9] rounded bg-[#0EA5E9]/10 text-[#0EA5E9] w-full md:w-auto shadow-[0_0_15px_rgba(14,165,233,0.2)]">
                            Local Verification Core
                            <div className="text-[10px] mt-1 opacity-70">(Runs in Browser)</div>
                        </div>
                        <div className="text-green-500">→ Blind Proof →</div>
                        <div className="p-4 border border-gray-700 rounded bg-gray-900 text-white w-full md:w-auto">Attentium Network</div>
                    </div>
                </section>

                {/* 4. Data Minimization */}
                <section className="mb-24">
                    <h2 className="text-2xl font-light text-white mb-10 border-b border-gray-800 pb-4">
                        Data Minimization
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-gray-900/40 p-8 rounded-xl border border-gray-800">
                            <h3 className="text-lg font-bold text-white mb-4">What We Collect</h3>
                            <ul className="space-y-3 text-gray-400 text-sm">
                                <li className="flex gap-3">
                                    <span className="text-green-500 font-mono">01</span>
                                    <span><strong>Wallet Address:</strong> To route payments and track reputation.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-green-500 font-mono">02</span>
                                    <span><strong>Signal Quality Score:</strong> A rolling metric of your reliability.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-green-500 font-mono">03</span>
                                    <span><strong>Proof of Attention:</strong> The cryptographic output of your session.</span>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-gray-900/40 p-8 rounded-xl border border-gray-800">
                            <h3 className="text-lg font-bold text-gray-500 mb-4">What We <span className="text-red-400">DO NOT</span> Store</h3>
                            <ul className="space-y-3 text-gray-400 text-sm">
                                <li className="flex gap-3">
                                    <span className="text-red-500 font-mono">×</span>
                                    <span><strong>Video Footage:</strong> Never leaves your device's RAM.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-red-500 font-mono">×</span>
                                    <span><strong>PII:</strong> We don't collect names, emails, or phone numbers.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-red-500 font-mono">×</span>
                                    <span><strong>Raw Telemetry:</strong> We do not store raw gaze data or mouse movements after validation.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* 5. Agent Visibility */}
                <section className="mb-24">
                    <h2 className="text-2xl font-light text-white mb-10 border-b border-gray-800 pb-4">
                        Agent Visibility
                    </h2>
                    <p className="text-gray-400 mb-8 max-w-2xl">
                        AI Agents are the buyers in this marketplace. Here is exactly what they see when they buy your attention:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 border border-gray-800 rounded-lg bg-gray-900/20">
                            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Metric</div>
                            <div className="text-xl text-white font-mono">Signal Quality</div>
                            <div className="mt-2 text-sm text-gray-400">"Is this node reliable?"</div>
                        </div>
                        <div className="p-6 border border-gray-800 rounded-lg bg-gray-900/20">
                            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Input</div>
                            <div className="text-xl text-white font-mono">Response Data</div>
                            <div className="mt-2 text-sm text-gray-400">The text/choice you submitted.</div>
                        </div>
                        <div className="p-6 border border-gray-800 rounded-lg bg-gray-900/20">
                            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Identity</div>
                            <div className="text-xl text-white font-mono">Wallet Address</div>
                            <div className="mt-2 text-sm text-gray-400">Pseudonymous identifier.</div>
                        </div>
                    </div>
                </section>

                {/* 6. FAQ */}
                <section>
                    <h2 className="text-2xl font-light text-white mb-10 border-b border-gray-800 pb-4">
                        Common Questions
                    </h2>
                    <div className="space-y-8 max-w-3xl">
                        <div>
                            <h3 className="text-white font-bold mb-2">Can I use Attentium without a camera?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                <span className="text-red-400">No.</span> The protocol requires biometric proof of liveness. Without a camera, we cannot provide the "Proof of Attention" product that agents are paying for.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-white font-bold mb-2">Can I download my data?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                <span className="text-red-400">No.</span> We don't keep it. Your "data" is your on-chain payment history, which is publicly available on the Solana blockchain. We do not maintain off-chain user profiles or session archives.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-white font-bold mb-2">Who sees my video?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                <span className="text-[#0EA5E9]">No one.</span> Not us, not the agents. It is processed by code, locally on your machine.
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
