import React from 'react';

interface PrivacyPolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative z-10 bg-[#0A0A0A] border border-gray-800 rounded-2xl max-w-3xl w-full h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#0A0A0A] rounded-t-2xl z-20">
                    <h2 className="text-xl font-semibold text-white">Privacy Policy</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar text-sm text-gray-400 leading-relaxed">
                    <div className="space-y-8">

                        <div>
                            <p className="mb-4"><strong>Last Updated:</strong> December 23, 2025</p>
                            <p>
                                This Privacy Policy describes how Blockpal LLC, a Wyoming limited liability company (“we,” “us,” or the “Protocol”), collects, uses, and discloses information, and what rights you have with respect to that information.
                            </p>
                            <p className="mt-2">
                                By connecting your Solana wallet or using the Attentium interface (the “Interface”), you agree to the practices described in this policy.
                            </p>
                        </div>

                        {/* 1. Data Controller */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">1. Data Controller</h3>
                            <p className="mb-2">For purposes of applicable data protection laws, including the General Data Protection Regulation (“GDPR”) and the California Consumer Privacy Act (“CCPA”), the data controller is:</p>
                            <div className="bg-gray-900 p-4 rounded border border-gray-800">
                                <p className="text-white">Blockpal LLC</p>
                                <p>Wyoming, United States</p>
                                <p>Email: <span className="text-[#0EA5E9]">support@attentium.ai</span></p>
                            </div>
                        </section>

                        {/* 2. Information We Collect */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">2. Information We Collect</h3>

                            <h4 className="text-white font-medium mb-2 mt-4">A. Information You Provide</h4>
                            <ul className="list-disc pl-5 space-y-2 mb-4">
                                <li><strong>Communication Data:</strong> If you contact us via email, we collect your email address and message content.</li>
                                <li><strong>Profile Data:</strong> We may collect voluntary inputs like usernames or preference settings linked to your wallet.</li>
                            </ul>

                            <h4 className="text-white font-medium mb-2 mt-4">B. Information Collected Automatically</h4>
                            <p className="mb-2"><strong>Device Telemetry:</strong> To prevent Sybil attacks and verify “Proof of Human Attention,” we collect limited technical signals, including:</p>
                            <ul className="list-disc pl-5 space-y-2 mb-2">
                                <li>User agent and browser type</li>
                                <li>Screen resolution and operating system</li>
                                <li>Session timing and interaction signals</li>
                            </ul>
                            <p className="italic bg-gray-900/50 p-2 rounded">These signals are not used for personal identification, combined to uniquely identify individuals, or used to create long-term behavioral profiles.</p>

                            <div className="mt-4 space-y-2">
                                <p><strong>Network Activity:</strong> We use Cloudflare for security. Cloudflare may process IP addresses per its policy.</p>
                                <p><strong>Blockchain Data:</strong> Your public Solana wallet address and on-chain transactions are public by design.</p>
                            </div>

                            <h4 className="text-white font-medium mb-2 mt-4">C. Biometric & Zero-Knowledge Verification Policy</h4>
                            <div className="border-l-2 border-[#0EA5E9] pl-4 space-y-2">
                                <p><strong>We do not collect, store, or transmit raw biometric data.</strong></p>
                                <p><strong>Client-Side Processing:</strong> Verification occurs locally on your device.</p>
                                <p><strong>Cryptographic Proofs Only:</strong> Only a proof (hash) is transmitted. No images/templates.</p>
                                <p><strong>No Central Database:</strong> We hold no facial databases.</p>
                            </div>
                        </section>

                        {/* 3. How We Use Information */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">3. How We Use Information</h3>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Operate the Protocol:</strong> Facilitate Agent-Human interactions.</li>
                                <li><strong>Security & Anti-Fraud:</strong> Detect bots and Sybil attacks.</li>
                                <li><strong>Protocol Improvement:</strong> Analyze aggregated usage trends.</li>
                            </ul>
                            <p className="mt-4 text-[#0EA5E9]">We do not sell personal data.</p>
                        </section>

                        {/* 4. Blockchain-Specific Disclosures */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">4. Blockchain-Specific Disclosures</h3>
                            <p className="mb-2">Your Solana wallet address may become permanently associated with on-chain actions.</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Immutability:</strong> Blockchain data cannot be altered or deleted.</li>
                                <li><strong>Public Visibility:</strong> Anyone may view interactions with Attentium smart contracts.</li>
                            </ul>
                        </section>

                        {/* 5. Third-Party Service Providers */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">5. Third-Party Service Providers</h3>
                            <p className="mb-2">We share limited info with infrastructure providers:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Privy:</strong> Wallet infrastructure</li>
                                <li><strong>RPC Providers:</strong> Solana blockchain access</li>
                                <li><strong>Cloudflare:</strong> Network security</li>
                                <li><strong>Mintlify:</strong> Documentation</li>
                            </ul>
                        </section>

                        {/* 6. Cookies & Local Storage */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">6. Cookies & Local Storage</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-green-900/20 p-4 rounded border border-green-900/30">
                                    <strong className="text-green-500 block mb-2">We Use:</strong>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>Wallet connection state</li>
                                        <li>Session integrity</li>
                                    </ul>
                                </div>
                                <div className="bg-red-900/20 p-4 rounded border border-red-900/30">
                                    <strong className="text-red-500 block mb-2">We DO NOT Use:</strong>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>Advertising cookies</li>
                                        <li>Cross-site tracking</li>
                                        <li>Third-party marketing analytics</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* 7. Data Retention */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">7. Data Retention</h3>
                            <p>We retain off-chain data only as long as necessary. Blockchain data is permanent and outside our control.</p>
                        </section>

                        {/* 8. Your Rights */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">8. Your Rights</h3>
                            <div className="space-y-4">
                                <div>
                                    <strong className="text-white">EU / UK (GDPR):</strong> Access, correct, delete off-chain data, restrict processing, portability.
                                </div>
                                <div>
                                    <strong className="text-white">California (CCPA / CPRA):</strong> Know collected data, request deletion, opt out of sale (we don't sell).
                                </div>
                                <div className="bg-gray-900 p-3 rounded text-sm">
                                    <p><strong>Exercising Your Rights:</strong> Email <span className="text-[#0EA5E9]">support@attentium.ai</span> with subject "Privacy Request."</p>
                                </div>
                            </div>
                        </section>

                        {/* 9. Children’s Information */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">9. Children’s Information</h3>
                            <p>The Protocol is not directed to individuals under 13.</p>
                        </section>

                        {/* 10. Security */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">10. Security</h3>
                            <p>We use industry-standard safeguards (TLS/SSL). However, use of the Protocol is at your own risk.</p>
                        </section>

                        {/* 11. Updates */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">11. Updates to This Policy</h3>
                            <p>Updates will be posted here with a revised effective date.</p>
                        </section>

                        {/* 12. Contact Us */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">12. Contact Us</h3>
                            <p>Email: <span className="text-[#0EA5E9]">support@attentium.ai</span></p>
                        </section>

                    </div>
                </div>

                {/* Footer Gradient */}
                <div className="h-4 bg-gradient-to-t from-[#0A0A0A] to-transparent pointer-events-none -mt-4 z-20" />
            </div>
        </div>
    );
};
