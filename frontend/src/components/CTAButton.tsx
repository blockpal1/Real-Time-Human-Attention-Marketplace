import { motion } from 'framer-motion';
import { useState } from 'react';

interface CTAButtonProps {
    text: string;
    onClick?: () => void;
}

export const CTAButton = ({ text, onClick }: CTAButtonProps) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <motion.button
            className="relative overflow-hidden px-10 py-4 rounded-full bg-transparent border border-[#0EA5E9] text-white font-semibold text-lg tracking-wide cursor-pointer group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
        >
            {/* Background fill on hover */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-[#0EA5E9] to-[#38BDF8]"
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 1 : 0 }}
                transition={{ duration: 0.3 }}
            />

            {/* Blue beam animation */}
            <motion.div
                className="absolute top-0 left-0 w-20 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                animate={{
                    x: isHovered ? ['0%', '500%'] : '-100%',
                }}
                transition={{
                    duration: 0.8,
                    ease: 'easeInOut',
                    repeat: isHovered ? Infinity : 0,
                    repeatDelay: 0.5,
                }}
            />

            {/* Glow effect */}
            <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                    boxShadow: isHovered
                        ? '0 0 30px rgba(14, 165, 233, 0.6), 0 0 60px rgba(14, 165, 233, 0.4), 0 0 90px rgba(14, 165, 233, 0.2)'
                        : '0 0 15px rgba(14, 165, 233, 0.3)'
                }}
                transition={{ duration: 0.3 }}
            />

            {/* Inner glow ring */}
            <motion.div
                className="absolute inset-[2px] rounded-full border border-[#0EA5E9]/30"
                animate={{ opacity: isHovered ? 0 : 1 }}
                transition={{ duration: 0.3 }}
            />

            {/* Text content */}
            <span className="relative z-10 flex items-center gap-3">
                {/* Initialize icon */}
                <motion.svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    animate={{ rotate: isHovered ? 360 : 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <motion.path
                        d="M12 6v6l4 2"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        animate={{ pathLength: isHovered ? [0, 1] : 1 }}
                        transition={{ duration: 0.5 }}
                    />
                </motion.svg>
                {text}
                {/* Arrow icon */}
                <motion.svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    animate={{ x: isHovered ? 5 : 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <path
                        d="M5 12h14M12 5l7 7-7 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </motion.svg>
            </span>

            {/* Particle effects on hover */}
            {isHovered && (
                <>
                    {[...Array(6)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-1 h-1 bg-[#0EA5E9] rounded-full"
                            initial={{
                                x: '50%',
                                y: '50%',
                                opacity: 1
                            }}
                            animate={{
                                x: `${50 + (Math.random() - 0.5) * 200}%`,
                                y: `${50 + (Math.random() - 0.5) * 200}%`,
                                opacity: 0,
                                scale: [1, 0]
                            }}
                            transition={{
                                duration: 0.8,
                                delay: i * 0.1,
                                repeat: Infinity,
                                repeatDelay: 0.5
                            }}
                        />
                    ))}
                </>
            )}
        </motion.button>
    );
};

export default CTAButton;
