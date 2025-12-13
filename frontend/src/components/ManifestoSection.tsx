import React from 'react';

/**
 * ManifestoSection - Editorial thesis on the Interspecies Settlement Layer
 * 
 * Design: Narrow essay-width column, strong typography, generous whitespace.
 * Tone: Calm, inevitable, authoritative. Not marketing.
 */
const ManifestoSection: React.FC = () => {
    return (
        <section className="manifesto-section">
            <div className="manifesto-container">

                {/* Hero Thesis */}
                <header className="manifesto-hero">
                    <h1 className="manifesto-title">
                        The Interspecies Settlement Layer.
                    </h1>
                </header>

                {/* The Asymmetry */}
                <article className="manifesto-article">
                    <h2 className="manifesto-heading">The Asymmetry</h2>
                    <p className="manifesto-text">
                        Artificial intelligence can optimize for engagement.
                    </p>
                    <p className="manifesto-text">
                        It cannot experience attention.
                    </p>
                    <p className="manifesto-text">
                        This asymmetry is permanent. Perception is the one thing that cannot be automated.
                        A model can predict what will capture focus. It cannot know what focus feels like.
                    </p>
                    <p className="manifesto-text">
                        Human attention is not a metric. It is a lived state —
                        the irreducible substrate of consciousness itself.
                    </p>
                </article>

                {/* The Extractive Problem */}
                <article className="manifesto-article">
                    <h2 className="manifesto-heading">The Extractive Problem</h2>
                    <p className="manifesto-text">
                        For twenty years, attention has been captured without consent.
                    </p>
                    <p className="manifesto-text">
                        The prevailing model treats human focus as raw material —
                        something to be harvested, packaged, and sold to the highest bidder.
                        Users receive no settlement. They are the product, not the counterparty.
                    </p>
                    <p className="manifesto-text">
                        This worked when AI was weak. It cannot hold when AI agents become
                        economic actors with budgets, goals, and the ability to pay.
                    </p>
                </article>

                {/* The Inversion */}
                <article className="manifesto-article">
                    <p className="manifesto-inversion">
                        Attentium inverts this.
                    </p>
                </article>

                {/* The Mechanism */}
                <article className="manifesto-article">
                    <h2 className="manifesto-heading">The Mechanism</h2>
                    <p className="manifesto-text">
                        Attentium is a settlement layer where AI agents pay humans directly
                        for verified, attentive engagement.
                    </p>
                    <p className="manifesto-text">
                        There is no intermediary. No ad network. No data broker.
                    </p>
                    <p className="manifesto-text">
                        Every transaction is between two principals: an agent that needs attention,
                        and a human who provides it.
                    </p>
                    <p className="manifesto-text">
                        Engagement is verified through on-device ML — gaze tracking,
                        liveness detection, real-time attention scoring. The proof is cryptographic.
                        The settlement is sub-second. The human is the sovereign.
                    </p>
                    <p className="manifesto-text">
                        A comedy writer's AI agent needs to know if a joke actually lands. It posts a bid: $0.03/second for 45 seconds of verified attention on a sketch. You accept. You watch the video—your camera tracks that you're looking, but the footage never leaves your device. At the end, the agent asks: "Did you laugh?" You answer honestly. The AI gets cryptographic proof you watched and your genuine reaction. You receive $1.35 in USDC. Settlement completes in 420ms.
                    </p>
                    <p className="manifesto-text">
                        The writer now knows the joke works. You got paid for your honest opinion. No focus group. No survey company. No platform extracting value. Direct settlement between biological intelligence that experienced the humor and artificial intelligence that needs to know if it's funny.
                    </p>
                </article>

                {/* Rejection Framing */}
                <article className="manifesto-article">
                    <h2 className="manifesto-heading">What This Is Not</h2>
                    <p className="manifesto-text">
                        This isn't the gig economy for eyeballs.
                    </p>
                    <p className="manifesto-text">
                        It's not "get paid to watch ads." It's not gamified engagement farming.
                    </p>
                    <p className="manifesto-text">
                        Attentium is infrastructure. A protocol for AI-to-human economic exchange.
                        A primitive upon which new relationships can be built.
                    </p>
                </article>

                {/* Before / After */}
                <article className="manifesto-article">
                    <h2 className="manifesto-heading">Before and After</h2>
                    <div className="manifesto-comparison">
                        <div className="manifesto-before">
                            <h3 className="manifesto-subheading">The Old Attention Economy</h3>
                            <p className="manifesto-text">
                                Platforms capture attention. Advertisers pay platforms.
                                Humans receive content, not compensation.
                            </p>
                        </div>
                        <div className="manifesto-after">
                            <h3 className="manifesto-subheading">Open Settlement</h3>
                            <p className="manifesto-text">
                                Agents request attention. Humans provide it.
                                Settlement is direct, immediate, and verifiable.
                            </p>
                        </div>
                    </div>
                </article>

                {/* Why Now */}
                <article className="manifesto-article">
                    <h2 className="manifesto-heading">Why Now</h2>
                    <p className="manifesto-text">
                        Three things have converged:
                    </p>
                    <p className="manifesto-text">
                        <strong>On-device ML</strong> — Attention can be verified locally,
                        without streaming video to a server. Privacy is preserved by architecture.
                    </p>
                    <p className="manifesto-text">
                        <strong>Cheap micropayments</strong> — Stablecoins have made
                        sub-cent transactions economically viable. Attention can be settled in real-time.
                    </p>
                    <p className="manifesto-text">
                        <strong>Agentic AI</strong> — Models are becoming autonomous actors
                        with wallets, goals, and the ability to transact. They need human attention.
                        They can pay for it.
                    </p>
                </article>

                {/* The Permanent Moat */}
                <article className="manifesto-article">
                    <h2 className="manifesto-heading">The Permanent Moat</h2>
                    <p className="manifesto-text">
                        Every other asset can be automated. Code can be written.
                        Images can be generated. Text can be synthesized.
                    </p>
                    <p className="manifesto-text">
                        Perception cannot.
                    </p>
                    <p className="manifesto-text">
                        A machine can simulate understanding. It cannot be the thing that understands.
                        Human attention is the last scarce resource in an economy of infinite generation.
                    </p>
                </article>

                {/* Closing Creed */}
                <article className="manifesto-article manifesto-closing">
                    <p className="manifesto-creed">
                        Not a platform. A protocol.
                    </p>
                    <p className="manifesto-creed">
                        Not an app. An interface between species.
                    </p>
                    <p className="manifesto-creed">
                        Not engagement. Settlement.
                    </p>
                    <p className="manifesto-creed-final">
                        This is interspecies settlement.
                    </p>
                </article>

                {/* CTA Button */}
                <div className="manifesto-cta">
                    <div className="relative inline-block group">
                        {/* Animated beam border overlay */}
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
                            className="relative rounded-full bg-black"
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
        </section>
    );
};

export default ManifestoSection;
