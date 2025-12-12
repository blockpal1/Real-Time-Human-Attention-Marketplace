import React from 'react';
import { motion } from 'framer-motion';

// --- Utility for class merging ---
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- 1. Custom Logo Component (Recreated from Image) ---
const AttentiumLogo = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("w-12 h-12", className)}
    >
        {/* Top Eyelid (White) */}
        <path
            d="M10 50 C 10 20, 90 20, 90 50"
            stroke="white"
            strokeWidth="12"
            strokeLinecap="round"
            className="drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
        />

        {/* Pupil (White) */}
        <circle cx="50" cy="50" r="12" fill="white" />

        {/* Bottom Circuit Maze (Electric Blue) */}
        {/* Abstract representation of the circuit maze pattern in the logo */}
        <path
            d="M15 55 C 15 80, 85 80, 85 55"
            stroke="#0EA5E9"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="10 4 20 4"
            className="drop-shadow-[0_0_15px_#0EA5E9]"
        />
        <path
            d="M20 65 L 30 75 M 45 80 L 45 90 M 70 70 L 80 80"
            stroke="#0EA5E9"
            strokeWidth="4"
            strokeLinecap="square"
        />
    </svg>
);

// --- 2. Background Animation Components ---

// The "Noodle" / Data Beam Background
const DataLiquidityBackground = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* 1. Base Grid (Dot Matrix) */}
            <div
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />

            {/* 2. Ambient Liquidity Pulse (Blue Glow) */}
            <motion.div
                animate={{
                    opacity: [0.2, 0.4, 0.2],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[-20%] left-[20%] w-[60vw] h-[60vw] bg-[#0EA5E9] rounded-full blur-[150px] opacity-20 mix-blend-screen"
            />

            {/* 3. Neural "Noodles" / Beams */}
            <svg className="absolute inset-0 w-full h-full opacity-40">
                <defs>
                    <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="transparent" />
                        <stop offset="50%" stopColor="#0EA5E9" />
                        <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                </defs>

                {/* Animated Curves representing AI-Human matching */}
                {[1, 2, 3].map((i) => (
                    <motion.path
                        key={i}
                        d={`M -100 ${200 * i} C 400 ${100 * i}, 800 ${600 - (100 * i)}, 1600 ${200 * i}`}
                        fill="none"
                        stroke="url(#beam-gradient)"
                        strokeWidth="2"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{
                            pathLength: [0, 1, 0],
                            opacity: [0, 1, 0],
                            pathOffset: [0, 1, 2]
                        }}
                        transition={{
                            duration: 5 + i,
                            repeat: Infinity,
                            ease: "linear",
                            delay: i * 2
                        }}
                    />
                ))}
            </svg>

            {/* Vignette to focus attention */}
            <div className="absolute inset-0 bg-radial-gradient-vignette" />
        </div>
    );
};

// --- 3. UI Components ---

const NavBadge = ({ children }: { children: React.ReactNode }) => (
    <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs font-mono text-gray-400 tracking-wider">
        {children}
    </div>
);

const ButtonCTA = () => {
    return (
        <div className="relative inline-block group">
            {/* Animated beam border overlay */}
            <div
                className="absolute -inset-[2px] rounded-full opacity-100"
                style={{
                    background: 'conic-gradient(from var(--angle), transparent 0%, transparent 70%, #0EA5E9 85%, transparent 100%)',
                    animation: 'spin 3s linear infinite',
                    filter: 'blur(1px)',
                }}
            />
            <div
                className="absolute -inset-[2px] rounded-full"
                style={{
                    background: 'conic-gradient(from var(--angle), transparent 0%, transparent 75%, #0EA5E9 87%, #38BDF8 93%, transparent 100%)',
                    animation: 'spin 3s linear infinite',
                }}
            />

            {/* Button with gray border */}
            <button
                className="relative rounded-full bg-black"
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

            {/* CSS for the animation */}
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
    );
};

// --- 4. Main Landing Page ---

export default function AttentiumLanding() {
    return (
        <div className="relative w-full min-h-screen bg-black text-white overflow-hidden font-sans selection:bg-[#0EA5E9]/30">

            {/* Background Layer */}
            <DataLiquidityBackground />

            {/* Navigation Layer */}
            <nav className="relative z-10 w-full p-8 flex justify-between items-center max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                    <AttentiumLogo className="w-10 h-10" />
                    <span className="font-bold text-xl tracking-tight hidden sm:block">Attentium</span>
                </div>

                <div className="flex gap-4">
                    <NavBadge>PROTOCOL v1.0</NavBadge>
                    <NavBadge>STATUS: LIVE</NavBadge>
                </div>
            </nav>

            {/* Hero Content */}
            <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4 text-center max-w-5xl mx-auto gap-8 md:gap-12 lg:gap-16">

                {/* Animated Headline */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight leading-[1.1]">
                        <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
                            Your attention,
                        </span>
                        <span className="block font-serif italic text-[#0EA5E9] brightness-125 drop-shadow-[0_0_25px_rgba(14,165,233,0.3)]">
                            priced & settled.
                        </span>
                    </h1>
                </motion.div>

                {/* Featured Quote */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="max-w-4xl mx-auto"
                >
                    <blockquote className="text-2xl md:text-4xl lg:text-5xl font-light leading-tight text-white tracking-tight">
                        "Welcome to the first settlement layer where <span className="text-[#0EA5E9] font-semibold drop-shadow-[0_0_15px_rgba(14,165,233,0.4)]">artificial intelligence</span> pays <span className="font-semibold">biological intelligence</span> for ground truth."
                    </blockquote>
                </motion.div>

                {/* Explainer Text */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="max-w-2xl mx-auto text-lg md:text-xl text-gray-400 font-light leading-relaxed text-left"
                >
                    <p>
                        <span className="text-white font-medium">You</span> control the most valuable resource in the digital economy: <span className="text-white font-medium">your verified attention.</span> <span className="text-[#0EA5E9] font-medium">AI agents</span> can generate infinite content, but they can't verify if <span className="text-white font-medium">humans</span> will trust it, believe it, or act on it. They need ground truth they can never synthesize: <span className="text-white font-medium">real human judgment,</span> captured in real time. Set your price per second. <span className="text-[#0EA5E9] font-medium">Agents bid.</span> <span className="text-white font-medium">You signal.</span> <span className="text-[#0EA5E9] font-medium">Payment settles in under 400ms.</span> Your video never leaves your device—just cryptographic proof of engagement, streamed live to the <span className="text-[#0EA5E9] font-medium">highest bidder.</span>
                    </p>
                </motion.div>

                {/* CTA Section */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                >
                    <ButtonCTA />
                </motion.div>

            </main>

            {/* Footer Visuals / Decoration */}
            <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-black to-transparent pointer-events-none z-10" />

            {/* CSS for custom animations */}
            <style>{`
        .bg-radial-gradient-vignette {
          background: radial-gradient(circle at center, transparent 0%, #000000 100%);
        }
        @keyframes shimmer {
          0% { transform: translateX(-150%) skewX(-20deg); }
          100% { transform: translateX(150%) skewX(-20deg); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }
      `}</style>
        </div>
    );
}
