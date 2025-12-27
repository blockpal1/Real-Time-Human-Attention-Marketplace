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

                <div className="p-8 overflow-y-auto custom-scrollbar text-sm text-gray-400 leading-relaxed">
                    <div className="space-y-8">

                        <div>
                            <p className="mb-4"><strong>Last Updated:</strong> December 23, 2025</p>
                            <p>
                                This Privacy Policy describes how Blockpal LLC (“we,” “us,” or the “Interface Operator”) processes limited off-chain information in connection with the Attentium Protocol.
                            </p>
                            <p className="mt-2">
                                The Attentium Protocol itself is a decentralized system of smart contracts deployed on the Solana blockchain. Blockpal LLC does not control on-chain data, transactions, or settlement.
                            </p>
                        </div>

                        {/* 1. Data Controller */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">1. Data Controller</h3>
                            <p className="mb-2">For purposes of applicable data protection laws, Blockpal LLC is the data controller only with respect to off-chain data processed via the Interface and oracle systems.</p>
                            <div className="bg-gray-900 p-4 rounded border border-gray-800">
                                <p className="text-white">Blockpal LLC</p>
                                <p>Wyoming, United States</p>
                                <p>Email: <a href="mailto:support@attentium.ai" className="text-[#0EA5E9] hover:underline">support@attentium.ai</a></p>
                            </div>
                            <p className="mt-2 text-sm italic">Blockpal LLC is not the controller of on-chain blockchain data.</p>
                        </section>

                        {/* 2. Information We Process */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">2. Information We Process</h3>

                            <h4 className="text-white font-medium mb-2 mt-4">A. Information You Provide</h4>
                            <ul className="list-disc pl-5 space-y-2 mb-4">
                                <li><strong>Communication Data:</strong> If you contact us, we process your email address and message content.</li>
                                <li><strong>Optional Profile Inputs:</strong> You may voluntarily submit usernames or preferences associated with a public wallet address.</li>
                            </ul>

                            <h4 className="text-white font-medium mb-2 mt-4">B. Information Processed Automatically</h4>
                            <p className="mb-2"><strong>Oracle & Security Telemetry:</strong> To support oracle verification and protocol security, we process limited technical signals such as:</p>
                            <ul className="list-disc pl-5 space-y-1 mb-2">
                                <li>Browser and device metadata</li>
                                <li>Session timing and interaction signals</li>
                            </ul>
                            <div className="bg-gray-900/50 p-2 rounded mb-2">
                                <p className="font-semibold text-white mb-1">These signals:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Are not used for personal identification</li>
                                    <li>Are not used for advertising or profiling</li>
                                    <li>Are processed solely to generate Oracle Signals and detect abuse</li>
                                </ul>
                            </div>
                            <p className="mb-1"><strong>Network Data:</strong> Cloudflare may process IP addresses and headers for security and availability purposes.</p>
                            <p><strong>Blockchain Data:</strong> Wallet addresses and transaction data are public by design and outside our control.</p>

                            <h4 className="text-white font-medium mb-2 mt-4">C. Biometric & Zero-Knowledge Verification</h4>
                            <div className="border-l-2 border-[#0EA5E9] pl-4 space-y-2">
                                <p><strong>We do not collect, store, or transmit raw biometric data.</strong></p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>All liveness checks or biometric-style verifications occur locally on your device.</li>
                                    <li>Only cryptographic proofs or verification signals are transmitted.</li>
                                    <li>No biometric databases are maintained.</li>
                                </ul>
                            </div>

                            <h4 className="text-white font-medium mb-2 mt-4">D. Oracle Processing and AI Systems</h4>
                            <p className="mb-2">Blockpal LLC operates oracle software that processes off-chain inputs to generate verification signals submitted to smart contracts.</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Oracle processing may involve artificial intelligence systems</li>
                                <li>Oracle outputs are attestations, not discretionary decisions</li>
                                <li>No oracle process results in custody or control of user funds</li>
                                <li>Raw inputs are not published on-chain</li>
                            </ul>
                            <p className="mt-2">Oracle systems are designed under principles of data minimization and security.</p>
                        </section>

                        {/* 3. How We Use Information */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">3. How We Use Information</h3>
                            <p className="mb-2">We process limited off-chain data to:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Operate the Interface</li>
                                <li>Generate and submit Oracle Signals</li>
                                <li>Detect fraud, abuse, or Sybil attacks</li>
                                <li>Maintain protocol security and reliability</li>
                            </ul>
                            <p className="mt-4 text-[#0EA5E9]">We do not sell personal data.</p>
                        </section>

                        {/* 4. Third-Party Service Providers */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">4. Third-Party Service Providers</h3>
                            <p className="mb-2">We rely on infrastructure providers, including:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Privy:</strong> Wallet infrastructure</li>
                                <li><strong>RPC Providers:</strong> Blockchain connectivity</li>
                                <li><strong>Cloudflare:</strong> DNS, CDN, and security</li>
                                <li><strong>Mintlify:</strong> Documentation hosting</li>
                            </ul>
                            <p className="mt-2 text-sm italic">These providers process data only as necessary to perform their services.</p>
                        </section>

                        {/* 5. Cookies & Local Storage */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">5. Cookies & Local Storage</h3>
                            <p className="mb-2">We use strictly necessary cookies and local storage to maintain session integrity and wallet connectivity.</p>
                            <p className="text-red-400">We do not use advertising cookies or third-party marketing analytics.</p>
                        </section>

                        {/* 6. Data Retention */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">6. Data Retention</h3>
                            <p className="mb-2">Off-chain data is retained only as long as necessary to operate the Interface, generate Oracle Signals, maintain security, or comply with legal obligations.</p>
                            <p>Blockchain data is permanent and outside our control.</p>
                        </section>

                        {/* 7. Your Rights */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">7. Your Rights</h3>
                            <div className="space-y-4">
                                <div>
                                    <strong className="text-white block mb-1">EU / UK (GDPR)</strong>
                                    <p>You may have rights to access, correct, delete, restrict, object to processing, or request portability of off-chain personal data.</p>
                                </div>
                                <div>
                                    <strong className="text-white block mb-1">California (CCPA / CPRA)</strong>
                                    <p>You may have rights to know, delete, and receive equal service regardless of exercising your rights. We do not sell personal data.</p>
                                </div>
                                <div>
                                    <strong className="text-white block mb-1">Limitations</strong>
                                    <p>We cannot delete or modify blockchain data.</p>
                                </div>
                                <div className="bg-gray-900 p-3 rounded text-sm">
                                    <p><strong>To exercise rights:</strong> Email <a href="mailto:support@attentium.ai" className="text-[#0EA5E9] hover:underline">support@attentium.ai</a> with the subject “Privacy Request.”</p>
                                </div>
                            </div>
                        </section>

                        {/* 8. Children’s Information */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">8. Children’s Information</h3>
                            <p>The Protocol is not directed to individuals under 13. We do not knowingly process children’s personal data.</p>
                        </section>

                        {/* 9. Security */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">9. Security</h3>
                            <p>We use industry-standard safeguards, including TLS/SSL encryption. No system is completely secure.</p>
                        </section>

                        {/* 10. Updates */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">10. Updates</h3>
                            <p>We may update this policy from time to time. Continued use constitutes acceptance.</p>
                        </section>

                        {/* 11. Contact */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">11. Contact</h3>
                            <p>For legal inquiries: <a href="mailto:support@attentium.ai" className="text-[#0EA5E9] hover:underline">support@attentium.ai</a></p>
                        </section>

                    </div>
                </div>

                {/* Footer Gradient */}
                <div className="h-4 bg-gradient-to-t from-[#0A0A0A] to-transparent pointer-events-none -mt-4 z-20" />
            </div>
        </div>
    );
};
