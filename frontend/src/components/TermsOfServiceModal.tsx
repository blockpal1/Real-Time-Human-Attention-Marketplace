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
                                These Terms govern your access to and use of the Attentium Protocol interface and related software (the “Interface”), made available at attentium.ai by Blockpal LLC, a Wyoming limited liability company (“we,” “us,” or the “Interface Operator”).
                            </p>
                            <p className="mb-2">
                                The Attentium Protocol is a decentralized system composed of smart contracts deployed on the Solana blockchain that enables interactions between AI agents and human participants.
                            </p>
                            <p className="mb-2">
                                Blockpal LLC does not operate the Protocol itself, custody assets, or control settlement. Our role is limited to:
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Operating the Interface</li>
                                <li>Maintaining oracle software that submits off-chain verification signals to smart contracts</li>
                                <li>Publishing or maintaining supporting software and documentation</li>
                            </ul>
                            <p className="mt-2">All economic activity, reward logic, and settlement occur exclusively on-chain via smart contracts.</p>
                        </section>

                        {/* 2. Season Zero / Beta Disclaimer */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">2. Season Zero / Beta Disclaimer</h3>
                            <div className="bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 p-4 rounded mb-4">
                                <strong className="text-[#0EA5E9] block mb-2">THE PROTOCOL IS CURRENTLY IN AN EXPERIMENTAL “SEASON ZERO” PHASE.</strong>
                                <p className="mb-2">You acknowledge and agree that:</p>
                                <ul className="list-disc pl-5 space-y-1 text-[#0EA5E9]/80">
                                    <li>The Protocol involves experimental software and novel economic mechanisms</li>
                                    <li>The Protocol may contain bugs, errors, or vulnerabilities</li>
                                    <li>You may experience interruptions, incorrect outputs, or loss of funds</li>
                                    <li>No guarantees are made regarding uptime, availability, or correctness</li>
                                </ul>
                            </div>
                            <p>You use the Protocol and Interface entirely at your own risk.</p>
                        </section>

                        {/* 3. The Protocol vs. the Interface */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">3. The Protocol vs. the Interface</h3>
                            <p className="mb-2"><strong className="text-white">Non-Custodial Architecture</strong></p>
                            <p className="mb-4">At no point does Blockpal LLC take custody of digital assets, private keys, wallets, or funds. We cannot initiate, reverse, pause, or modify on-chain transactions.</p>

                            <p className="mb-2"><strong className="text-white">Oracle Function</strong></p>
                            <p className="mb-2">Certain smart contracts rely on off-chain verification signals (“Oracle Signals”) to determine whether protocol-defined work has been completed.</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Oracle Signals may be generated using automated systems, including artificial intelligence models</li>
                                <li>Blockpal LLC maintains control over the oracle software and its prompt configuration</li>
                                <li>Oracle Signals are attestations, not discretionary approvals</li>
                                <li>Smart contracts alone determine settlement outcomes</li>
                            </ul>
                            <p className="mt-2">Submission of an Oracle Signal does not guarantee rewards, payouts, or results.</p>
                        </section>

                        {/* 4. Eligibility */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">4. Eligibility</h3>
                            <p className="mb-2">To access or use the Interface, you represent and warrant that you:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Are at least 18 years old</li>
                                <li>Are not located in, a resident of, or acting on behalf of any jurisdiction subject to U.S. sanctions</li>
                                <li>Are not listed on, or owned or controlled by, any restricted or denied party list (including OFAC)</li>
                                <li>Are legally permitted to use crypto assets and decentralized protocols under applicable law</li>
                            </ul>
                        </section>

                        {/* 5. Prohibited Conduct */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">5. Prohibited Conduct</h3>
                            <p className="mb-2">You agree not to:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Attack, disrupt, or compromise the Protocol or Interface</li>
                                <li>Conduct Sybil attacks, automated verification abuse, or bot-based manipulation (unless explicitly authorized via an Agent API)</li>
                                <li>Engage in wash trading or artificial inflation of attention metrics</li>
                                <li>Use the Protocol for unlawful, exploitative, or abusive purposes</li>
                                <li>Circumvent security, verification, or eligibility mechanisms</li>
                            </ul>
                            <p className="mt-2 text-red-400">Violations may result in suspension, invalidation of rewards, or restricted access.</p>
                        </section>

                        {/* 6. Intellectual Property */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">6. Intellectual Property</h3>
                            <p className="mb-2"><strong className="text-white">Our Rights</strong><br />The Attentium name, branding, and Interface design are owned by Blockpal LLC.</p>
                            <p><strong className="text-white">Open-Source Components</strong><br />Smart contracts, SDKs, and other components may be open-sourced and are governed by their respective licenses as published in their repositories.</p>
                        </section>

                        {/* 7. Assumption of Risk */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">7. Assumption of Risk</h3>
                            <p className="mb-2">You expressly acknowledge and assume all risks associated with:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Blockchain technology and smart contracts</li>
                                <li>Oracle-based systems and off-chain verification</li>
                                <li>Artificial intelligence systems and probabilistic outputs</li>
                                <li>Network congestion, outages, or consensus failures</li>
                                <li>Regulatory uncertainty related to crypto assets and attention markets</li>
                            </ul>
                            <p className="mt-2">Oracle systems may produce false positives, false negatives, or delayed signals. You assume all risks arising from reliance on Oracle Signals.</p>
                        </section>

                        {/* 8. Disclaimers & Limitation of Liability */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">8. Disclaimers & Limitation of Liability</h3>
                            <p className="mb-2 uppercase font-bold text-white">THE INTERFACE IS PROVIDED “AS IS” AND “AS AVAILABLE.”</p>
                            <p className="mb-2">To the maximum extent permitted by law:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>All warranties are disclaimed</li>
                                <li>We are not liable for losses due to smart contract bugs, oracle errors, wallet compromise, verification failures, or third-party actions</li>
                                <li>We are not liable for indirect, incidental, or consequential damages</li>
                            </ul>
                            <div className="bg-gray-900 border border-gray-800 p-4 rounded mt-4">
                                <strong className="text-white block">LIABILITY CAP:</strong>
                                <p>Our total liability to you shall not exceed $100 USD.</p>
                            </div>
                        </section>

                        {/* 9. Termination */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">9. Termination</h3>
                            <p>We may suspend or terminate your access to the Interface at any time if we reasonably believe you have violated these Terms or applicable law.</p>
                        </section>

                        {/* 10. Protocol Safeguards and Emergency Pauses */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">10. Protocol Safeguards and Emergency Pauses</h3>
                            <p className="mb-2">The Protocol includes safety mechanisms designed to protect system integrity.</p>

                            <p className="mb-2"><strong className="text-white">Emergency Pause Authority</strong><br />The Protocol maintainers reserve the right to pause oracle feeds or related verification mechanisms in the event of a detected security anomaly, exploit risk, or network instability.</p>

                            <p className="mb-2"><strong className="text-white">Effect of a Pause</strong></p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>No new “Proof of Attention” signals will be generated</li>
                                <li>No new rewards or verifications will be issued</li>
                                <li>Funds committed to smart contracts remain locked and governed solely by contract logic</li>
                            </ul>
                            <p className="mt-2">An emergency pause does not grant Blockpal LLC custody, ownership, or discretionary control over user funds.</p>
                        </section>

                        {/* 11. Oracle Upgrades */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">11. Oracle Upgrades</h3>
                            <p className="mb-2">Oracle software, including prompt configurations and verification logic, may be updated or upgraded over time.</p>
                            <p>Any such upgrades apply only to work submitted after the upgrade becomes effective. Previously completed work remains governed by the oracle logic in effect at the time of submission.</p>
                        </section>

                        {/* 12. Governing Law & Arbitration */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">12. Governing Law & Arbitration</h3>
                            <p className="mb-2">These Terms are governed by the laws of the State of Wyoming, without regard to conflict of law principles.</p>
                            <p>Any dispute arising out of or relating to these Terms shall be resolved by <strong>binding arbitration in Wyoming</strong>, except where prohibited by law.</p>
                        </section>

                        {/* 13. Modifications */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">13. Modifications</h3>
                            <p>We may update these Terms from time to time. Updates will be posted with a revised “Last Updated” date. Continued use constitutes acceptance.</p>
                        </section>

                        {/* 14. Contact */}
                        <section>
                            <h3 className="text-white text-lg font-semibold mb-3">14. Contact</h3>
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
