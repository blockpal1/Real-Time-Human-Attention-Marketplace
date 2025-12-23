import React from 'react';

interface TermsOfServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ isOpen, onClose }) => {
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
                    <h2 className="text-xl font-semibold text-white">Terms of Service</h2>
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
                            <p className="font-bold text-white mb-2">PLEASE READ THESE TERMS CAREFULLY.</p>
                            <p>
                                By accessing or using the Attentium Protocol or its interface, you agree to be bound by these Terms of Service (“Terms”).
                            </p>
                        </div>

                        {/* 1. Introduction */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">1. Introduction</h3>
                            <p className="mb-2">
                                These Terms govern your access to and use of the Attentium Protocol interface and related services (the “Interface”), made available at attentium.ai by Blockpal LLC, a Wyoming limited liability company (“we,” “us,” or “our”).
                            </p>
                            <p>
                                The Attentium Protocol is a decentralized system enabling interactions between AI agents and human participants via smart contracts deployed on the Solana blockchain.
                            </p>
                        </section>

                        {/* 2. Season Zero / Beta Disclaimer */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">2. Season Zero / Beta Disclaimer</h3>
                            <div className="bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 p-4 rounded mb-4">
                                <strong className="text-[#0EA5E9] block mb-2">THE PROTOCOL IS CURRENTLY IN AN EXPERIMENTAL “SEASON ZERO” PHASE.</strong>
                                <ul className="list-disc pl-5 space-y-1 text-[#0EA5E9]/80">
                                    <li>The Protocol involves experimental software and novel economic mechanisms</li>
                                    <li>The Protocol may contain bugs, errors, or vulnerabilities</li>
                                    <li>You may experience service interruptions or loss of funds</li>
                                    <li>No guarantees are made regarding uptime or correctness</li>
                                </ul>
                            </div>
                            <p>You use the Protocol entirely at your own risk.</p>
                        </section>

                        {/* 3. The Protocol vs. the Interface */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">3. The Protocol vs. the Interface</h3>
                            <p className="mb-2"><strong className="text-white">Non-Custodial:</strong> We do not custody digital assets, private keys, wallets, or funds. You are solely responsible for securing your wallet and credentials.</p>
                            <p><strong className="text-white">No Intermediary Relationship:</strong> We do not act as a broker, financial institution, agent, fiduciary, or creditor. All value transfers occur directly on-chain.</p>
                        </section>

                        {/* 4. Eligibility */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">4. Eligibility</h3>
                            <p className="mb-2">To use the Interface, you represent that you:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Are at least 18 years of age</li>
                                <li>Are not located in a U.S. sanctioned jurisdiction</li>
                                <li>Are not listed on any U.S. government restricted list (OFAC)</li>
                                <li>Are legally permitted to use crypto assets under applicable law</li>
                            </ul>
                        </section>

                        {/* 5. Prohibited Conduct */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">5. Prohibited Conduct</h3>
                            <p className="mb-2">You agree not to:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Disrupt or compromise the Protocol</li>
                                <li>Conduct Sybil attacks or automated abuse</li>
                                <li>Engage in wash trading or market manipulation</li>
                                <li>Use the Protocol for unlawful purposes</li>
                                <li>Circumvent security mechanisms</li>
                            </ul>
                            <p className="mt-2 text-red-400">We reserve the right to restrict access or invalidate rewards for violations.</p>
                        </section>

                        {/* 6. Intellectual Property */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">6. Intellectual Property</h3>
                            <p className="mb-2"><strong className="text-white">Our Rights:</strong> The Attentium name, branding, and Interface design are owned by Blockpal LLC.</p>
                            <p><strong className="text-white">Open Source:</strong> Smart contracts and SDKs are governed by their respective open-source licenses.</p>
                        </section>

                        {/* 7. Assumption of Risk */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">7. Assumption of Risk</h3>
                            <p className="mb-2">You assume all risks associated with:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Blockchain technology and smart contracts</li>
                                <li>Volatility of digital assets</li>
                                <li>Network congestion or outages</li>
                                <li>Regulatory uncertainty</li>
                            </ul>
                        </section>

                        {/* 8. Disclaimers & Limitation of Liability */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">8. Disclaimers & Limitation of Liability</h3>
                            <p className="mb-2 uppercase font-bold text-white">THE INTERFACE IS PROVIDED “AS IS” AND “AS AVAILABLE.”</p>
                            <p className="mb-2">To the maximum extent permitted by law, we disclaim all warranties and are not responsible for smart contract bugs, wallet compromise, or third-party actions.</p>
                            <div className="bg-gray-900 border border-gray-800 p-4 rounded mt-4">
                                <strong className="text-white block">LIABILITY CAP:</strong>
                                <p>Our total liability to you shall not exceed $100 USD.</p>
                            </div>
                        </section>

                        {/* 9. Termination */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">9. Termination</h3>
                            <p>We may suspend or terminate access at any time if we believe you have violated these Terms.</p>
                        </section>

                        {/* 10. Governing Law & Arbitration */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">10. Governing Law & Arbitration</h3>
                            <p className="mb-2">Governed by the laws of the State of Wyoming.</p>
                            <p>Any dispute shall be resolved by <strong>binding arbitration in Wyoming</strong>, except where prohibited by law.</p>
                        </section>

                        {/* 11. Modifications */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">11. Modifications</h3>
                            <p>Updates will be posted with a revised “Last Updated” date. Continued use constitutes acceptance.</p>
                        </section>

                        {/* 12. Contact */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">12. Contact</h3>
                            <p>For legal inquiries: <span className="text-[#0EA5E9]">support@attentium.ai</span></p>
                        </section>

                    </div>
                </div>

                {/* Footer Gradient */}
                <div className="h-4 bg-gradient-to-t from-[#0A0A0A] to-transparent pointer-events-none -mt-4 z-20" />
            </div>
        </div>
    );
};
