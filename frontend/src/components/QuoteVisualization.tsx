import { motion } from 'framer-motion';

export const QuoteVisualization = () => {
    return (
        <section className="relative w-full min-h-screen bg-gradient-to-br from-black via-[#0a0a1a] to-black overflow-hidden flex items-center justify-end">

            {/* Background ambient glow */}
            <div className="absolute inset-0">
                <motion.div
                    className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-[#00D9FF]/10 rounded-full blur-[120px]"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </div>

            {/* Quote text - positioned above visualization */}
            <motion.div
                className="absolute top-24 left-0 right-0 z-20 px-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.5 }}
            >
                <blockquote className="max-w-4xl mx-auto text-white font-light text-2xl md:text-3xl lg:text-4xl leading-tight tracking-tight text-center">
                    <span className="block">Welcome to the first</span>
                    <span className="block mt-2">
                        <span className="text-[#00D9FF] font-medium">settlement layer</span>
                    </span>
                    <span className="block mt-2">where artificial intelligence</span>
                    <span className="block mt-2">pays biological intelligence</span>
                    <span className="block mt-2">for ground truth.</span>
                </blockquote>
            </motion.div>

            {/* Main visualization container - right 2/3 */}
            <div className="relative w-2/3 h-screen flex items-center justify-center">

                <svg
                    viewBox="0 0 800 600"
                    className="w-full h-full"
                    style={{ maxWidth: '900px' }}
                >
                    <defs>
                        {/* Gradients */}
                        <linearGradient id="organicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                            <stop offset="100%" stopColor="#e0e0e0" stopOpacity="0.7" />
                        </linearGradient>

                        <linearGradient id="geometricGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#00D9FF" stopOpacity="1" />
                            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.8" />
                        </linearGradient>

                        {/* Glow filters */}
                        <filter id="organicGlow">
                            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>

                        <filter id="geometricGlow">
                            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Geometric form (artificial intelligence) - LEFT side */}
                    <motion.g
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    >
                        <motion.path
                            d="M 180 280 L 260 250 L 300 300 L 280 380 L 200 400 L 160 340 Z"
                            fill="url(#geometricGradient)"
                            filter="url(#geometricGlow)"
                            animate={{
                                rotate: [0, 5, 0],
                            }}
                            transition={{
                                duration: 10,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                            style={{ transformOrigin: '230px 325px' }}
                        />

                        {/* Circuit-like details */}
                        <motion.g
                            animate={{
                                opacity: [0.6, 1, 0.6],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        >
                            <line x1="200" y1="300" x2="260" y2="300" stroke="#00D9FF" strokeWidth="1" opacity="0.8" />
                            <line x1="210" y1="330" x2="250" y2="330" stroke="#00D9FF" strokeWidth="1" opacity="0.8" />
                            <line x1="220" y1="360" x2="240" y2="360" stroke="#00D9FF" strokeWidth="1" opacity="0.8" />
                            <circle cx="200" cy="300" r="2" fill="#00D9FF" />
                            <circle cx="260" cy="300" r="2" fill="#00D9FF" />
                            <circle cx="230" cy="330" r="2" fill="#00D9FF" />
                        </motion.g>
                    </motion.g>

                    {/* Organic form (biological intelligence) - RIGHT side */}
                    <motion.g
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                    >
                        <motion.path
                            d="M 470 300 Q 520 200, 600 250 Q 640 280, 620 350 Q 600 420, 520 400 Q 440 380, 470 300 Z"
                            fill="url(#organicGradient)"
                            filter="url(#organicGlow)"
                            animate={{
                                d: [
                                    "M 470 300 Q 520 200, 600 250 Q 640 280, 620 350 Q 600 420, 520 400 Q 440 380, 470 300 Z",
                                    "M 470 300 Q 530 190, 610 240 Q 650 270, 630 360 Q 610 430, 510 410 Q 430 390, 470 300 Z",
                                    "M 470 300 Q 520 200, 600 250 Q 640 280, 620 350 Q 600 420, 520 400 Q 440 380, 470 300 Z",
                                ],
                            }}
                            transition={{
                                duration: 12,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />

                        {/* Subtle inner detail */}
                        <motion.ellipse
                            cx="550"
                            cy="320"
                            rx="40"
                            ry="50"
                            fill="white"
                            opacity="0.15"
                            animate={{
                                opacity: [0.1, 0.2, 0.1],
                            }}
                            transition={{
                                duration: 4,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />
                    </motion.g>

                    {/* Connection bridge/data exchange */}
                    <motion.g
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 2, delay: 1 }}
                    >
                        {/* Thin connecting line */}
                        <motion.line
                            x1="300"
                            y1="340"
                            x2="470"
                            y2="340"
                            stroke="#00D9FF"
                            strokeWidth="1"
                            opacity="0.4"
                            strokeDasharray="5,5"
                            animate={{
                                strokeDashoffset: [0, -10],
                                opacity: [0.2, 0.6, 0.2],
                            }}
                            transition={{
                                strokeDashoffset: {
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "linear",
                                },
                                opacity: {
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                },
                            }}
                        />

                        {/* Particle effects at connection points */}
                        {[0, 1, 2].map((i) => (
                            <motion.circle
                                key={i}
                                cx="300"
                                cy="340"
                                r="2"
                                fill="#00D9FF"
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{
                                    opacity: [0, 1, 0],
                                    scale: [0, 1.5, 0],
                                    x: [0, 30 * (i + 1), 60 * (i + 1)],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    delay: i * 0.6,
                                    ease: "easeOut",
                                }}
                            />
                        ))}

                        {/* Connection point glow */}
                        <motion.circle
                            cx="385"
                            cy="340"
                            r="8"
                            fill="#00D9FF"
                            opacity="0.3"
                            filter="url(#geometricGlow)"
                            animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.2, 0.4, 0.2],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />
                    </motion.g>
                </svg>
            </div>

            {/* Subtle grid overlay */}
            <div
                className="absolute inset-0 opacity-[0.02] pointer-events-none"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(0, 217, 255, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 217, 255, 0.3) 1px, transparent 1px)
          `,
                    backgroundSize: '60px 60px'
                }}
            />
        </section>
    );
};

export default QuoteVisualization;
