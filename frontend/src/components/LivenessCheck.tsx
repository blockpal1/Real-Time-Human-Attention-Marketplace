import React, { useRef } from 'react';
import { useFaceLiveness } from '../hooks/useFaceLiveness';

interface LivenessCheckProps {
    onVerified: () => void;
    active: boolean;
    videoRef?: React.RefObject<HTMLVideoElement>; // Accept external ref
}

export const LivenessCheck: React.FC<LivenessCheckProps> = ({ onVerified, active, videoRef: externalVideoRef }) => {
    // Use external ref if provided, otherwise fallback to local (though local won't start stream anymore)
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const videoRef = externalVideoRef || localVideoRef;

    const { status, challenge, progress, isVerified } = useFaceLiveness({
        videoRef,
        onVerified,
        active
    });

    const getInstruction = () => {
        switch (challenge) {
            case 'smile': return 'PLEASE SMILE 😊';
            case 'blink': return 'BLINK YOUR EYES 😉';
            case 'tilt': return 'TILT YOUR HEAD 🙃';
            default: return 'PREPARING...';
        }
    };

    if (!active) return null;

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
        }}>
            {/* Hidden Video Feed - Privacy First */}
            {/* Only render local video if no external ref provided */}
            {!externalVideoRef && (
                <video
                    ref={localVideoRef}
                    style={{ opacity: 0, position: 'absolute', pointerEvents: 'none', zIndex: -1 }}
                    playsInline
                    autoPlay
                    muted
                    width={640}
                    height={480}
                />
            )}

            {/* Status & Instructions */}
            <div style={{ textAlign: 'center', zIndex: 10 }}>
                <div style={{ color: '#00FF41', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>HUMAN VERIFICATION</div>

                {status === 'loading' && (
                    <div style={{ color: '#666', fontSize: '14px' }}>Starting Camera...</div>
                )}

                {status === 'error' && (
                    <div style={{ color: '#ff4444', fontSize: '14px' }}>Camera Access Denied. Cannot verify.</div>
                )}

                {status === 'ready' && !isVerified && (
                    <>
                        <div style={{
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: 'white',
                            marginBottom: '32px',
                            animation: 'pulse 2s infinite'
                        }}>
                            {getInstruction()}
                        </div>

                        {/* Tech Head Visualizer */}
                        <div style={{
                            position: 'relative',
                            width: '240px', // Increased size
                            height: '280px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '24px'
                        }}>
                            {/* Hologram Head */}
                            <img
                                src="/assets/tech_head.png"
                                alt="Signal Visualizer"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    mixBlendMode: 'screen',
                                    filter: `brightness(${0.8 + (progress / 100)}) drop-shadow(0 0 ${progress / 3}px ${challenge === 'blink' ? '#bd00ff' : '#00FFFF'})`, // Dynamic glow
                                    transition: 'filter 0.1s ease-out'
                                }}
                            />

                            {/* Scanning Line */}
                            <div style={{
                                position: 'absolute',
                                left: 0,
                                width: '100%',
                                height: '2px',
                                background: 'linear-gradient(90deg, transparent, #00FF41, transparent)',
                                boxShadow: '0 0 10px #00FF41',
                                animation: 'scan 3s linear infinite',
                                opacity: 0.7
                            }} />

                            {/* Verification Ring Overlay (Subtle) */}
                            <div style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                border: `2px solid ${isVerified ? '#00FF41' : 'transparent'}`,
                                borderRadius: '50%',
                                transition: 'all 0.5s',
                                boxShadow: isVerified ? '0 0 30px #00FF41 inset' : 'none',
                                opacity: 0.5
                            }} />
                        </div>

                        <div style={{ color: '#888', fontSize: '10px', letterSpacing: '2px' }}>
                            {Math.round(progress)}% SIGNAL STRENGTH
                        </div>
                    </>
                )}

                {isVerified && (
                    <div style={{ color: '#00FF41', fontSize: '24px', fontWeight: 'bold' }}>✓ VERIFIED</div>
                )}
            </div>

            <style>{`
                @keyframes pulse {
                    0% { opacity: 0.8; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.05); }
                    100% { opacity: 0.8; transform: scale(1); }
                }
                @keyframes scan {
                    0% { top: 10%; opacity: 0; }
                    10% { opacity: 0.8; }
                    90% { opacity: 0.8; }
                    100% { top: 90%; opacity: 0; }
                }
            `}</style>
        </div>
    );
};
