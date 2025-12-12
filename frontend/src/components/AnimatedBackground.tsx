import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface NoodleProps {
    delay: number;
    duration: number;
    startX: number;
    startY: number;
    controlX: number;
    controlY: number;
    endX: number;
    endY: number;
}

const Noodle = ({ delay, duration, startX, startY, controlX, controlY, endX, endY }: NoodleProps) => {
    const pathD = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;

    return (
        <motion.path
            d={pathD}
            fill="none"
            stroke="url(#beamGradient)"
            strokeWidth="1"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
                pathLength: [0, 1, 1, 0],
                opacity: [0, 0.6, 0.6, 0]
            }}
            transition={{
                duration: duration,
                delay: delay,
                repeat: Infinity,
                ease: "easeInOut",
            }}
        />
    );
};

interface NodeProps {
    x: number;
    y: number;
    size: number;
    delay: number;
    type: 'ai' | 'human';
}

const Node = ({ x, y, size, delay, type }: NodeProps) => {
    const color = type === 'ai' ? '#0EA5E9' : '#FFFFFF';

    return (
        <motion.g>
            <motion.circle
                cx={x}
                cy={y}
                r={size}
                fill="none"
                stroke={color}
                strokeWidth="1"
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                    opacity: [0.2, 0.8, 0.2],
                    scale: [0.8, 1.2, 0.8]
                }}
                transition={{
                    duration: 6,
                    delay: delay,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
            <motion.circle
                cx={x}
                cy={y}
                r={size * 0.4}
                fill={color}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{
                    duration: 5,
                    delay: delay + 1,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
        </motion.g>
    );
};

const DataBeam = ({ startX, startY, endX, endY, delay }: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    delay: number;
}) => {
    return (
        <motion.line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke="url(#dataBeamGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
                pathLength: [0, 1],
                opacity: [0, 1, 1, 0]
            }}
            transition={{
                duration: 4,
                delay: delay,
                repeat: Infinity,
                repeatDelay: 6,
                ease: "easeInOut",
            }}
        />
    );
};

export const AnimatedBackground = () => {
    const noodles = useMemo(() => {
        const paths: NoodleProps[] = [];
        for (let i = 0; i < 15; i++) {
            paths.push({
                delay: i * 1,
                duration: 8 + Math.random() * 6,
                startX: Math.random() * 100,
                startY: Math.random() * 100,
                controlX: 30 + Math.random() * 40,
                controlY: 30 + Math.random() * 40,
                endX: Math.random() * 100,
                endY: Math.random() * 100,
            });
        }
        return paths;
    }, []);

    const nodes = useMemo(() => {
        const nodeList: NodeProps[] = [];
        // AI nodes (left side)
        for (let i = 0; i < 5; i++) {
            nodeList.push({
                x: 10 + Math.random() * 25,
                y: 20 + i * 15,
                size: 3 + Math.random() * 2,
                delay: i * 0.3,
                type: 'ai'
            });
        }
        // Human nodes (right side)
        for (let i = 0; i < 5; i++) {
            nodeList.push({
                x: 65 + Math.random() * 25,
                y: 20 + i * 15,
                size: 3 + Math.random() * 2,
                delay: i * 0.3 + 0.5,
                type: 'human'
            });
        }
        return nodeList;
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Liquidity wash effect */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0EA5E9] to-transparent opacity-10"
                style={{ width: '200%', marginLeft: '-50%' }}
                animate={{
                    x: ['-100%', '100%'],
                }}
                transition={{
                    duration: 16,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />

            {/* Secondary liquidity wash */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0EA5E9] to-transparent opacity-5"
                style={{ width: '150%', marginLeft: '-25%' }}
                animate={{
                    x: ['100%', '-100%'],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear",
                    delay: 4,
                }}
            />

            {/* Gentle pulse circles */}
            <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-[#0EA5E9]/10"
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.1, 0.2, 0.1],
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-[#0EA5E9]/15"
                animate={{
                    scale: [1.1, 1, 1.1],
                    opacity: [0.15, 0.25, 0.15],
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 2,
                }}
            />

            <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-[#0EA5E9]/20"
                animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.2, 0.3, 0.2],
                }}
                transition={{
                    duration: 7,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1,
                }}
            />

            {/* SVG Noodle Pattern */}
            <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid slice"
            >
                <defs>
                    <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0" />
                        <stop offset="50%" stopColor="#0EA5E9" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="dataBeamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0" />
                        <stop offset="30%" stopColor="#0EA5E9" stopOpacity="1" />
                        <stop offset="70%" stopColor="#FFFFFF" stopOpacity="1" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </linearGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="1" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Noodle paths */}
                <g filter="url(#glow)">
                    {noodles.map((noodle, index) => (
                        <Noodle key={index} {...noodle} />
                    ))}
                </g>

                {/* AI and Human nodes */}
                <g filter="url(#glow)">
                    {nodes.map((node, index) => (
                        <Node key={index} {...node} />
                    ))}
                </g>

                {/* Data transfer beams between AI and Human */}
                <g filter="url(#glow)">
                    <DataBeam startX={25} startY={30} endX={75} endY={35} delay={0} />
                    <DataBeam startX={20} startY={50} endX={80} endY={55} delay={1.5} />
                    <DataBeam startX={30} startY={70} endX={70} endY={65} delay={3} />
                </g>
            </svg>

            {/* Ambient glow spots */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#0EA5E9]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#0EA5E9]/5 rounded-full blur-3xl" />

            {/* Grid overlay */}
            <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(14, 165, 233, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14, 165, 233, 0.3) 1px, transparent 1px)
          `,
                    backgroundSize: '50px 50px'
                }}
            />
        </div>
    );
};

export default AnimatedBackground;
