import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { LivenessCheck } from './LivenessCheck';
import { useAttentionAI } from '../hooks/useAttentionAI';

interface MatchNotificationModalProps {
    match: {
        matchId: string;
        bidId?: string; // tx_hash for x402 orders
        price: number;
        duration: number;
        topic?: string | object;
        contentUrl?: string | null;
        validationQuestion?: string | null;
    };
    walletPubkey?: string | null; // User wallet for fee distribution
    onAccept: () => void;
    onDismiss: () => void;
}

type Phase = 'matching' | 'preparing' | 'liveness' | 'expanding' | 'focused' | 'question' | 'verifying' | 'rejected' | 'banned' | 'success';
const HANDSHAKE_TIMEOUT = 10;
const PREP_COUNTDOWN = 3;
const QUESTION_GRACE_PERIOD = 30; // 30 seconds to answer question

export const MatchNotificationModal: React.FC<MatchNotificationModalProps> = ({ match, walletPubkey, onAccept, onDismiss }) => {
    const [phase, setPhase] = useState<Phase>('matching');
    const [countdown, setCountdown] = useState(HANDSHAKE_TIMEOUT);
    const [prepCountdown, setPrepCountdown] = useState(PREP_COUNTDOWN);
    const [sessionTime, setSessionTime] = useState(match.duration);
    const [questionTime, setQuestionTime] = useState(QUESTION_GRACE_PERIOD);

    const [failedVerification, setFailedVerification] = useState(false);
    const [answer, setAnswer] = useState('');
    const [initialDuration] = useState(match.duration); // Store initial duration
    const [rejectionMessage, setRejectionMessage] = useState('');

    const topicDisplay = typeof match.topic === 'string' ? match.topic : 'Ad Campaign';
    const totalEarnings = match.price * match.duration;
    const contentUrl = match.contentUrl;
    const validationQuestion = match.validationQuestion;

    // Liveness Timer (DISABLED - not currently used)
    /*
    useEffect(() => {
        if (phase !== 'liveness') return;
        const timer = setInterval(() => {
            setLivenessTime(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setFailedVerification(true);
                    setTimeout(() => onDismiss(), 3000); // Close after 3s
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase, onDismiss]);
    */

    // Matching phase countdown
    useEffect(() => {
        if (phase !== 'matching') return;
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(timer); onDismiss(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase, onDismiss]);

    // Preparation phase countdown
    useEffect(() => {
        if (phase !== 'preparing') return;
        const timer = setInterval(() => {
            setPrepCountdown(prev => {
                if (prev <= 1) { clearInterval(timer); setPhase('liveness'); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    // Shared Camera Stream Management
    const sharedVideoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Camera phases: preparing, liveness, expanding, focused
    const isCameraPhase = phase === 'preparing' || phase === 'liveness' || phase === 'expanding' || phase === 'focused';

    useEffect(() => {
        const startSharedCamera = async () => {
            if (!sharedVideoRef.current) return;
            // If already has stream, don't restart
            if (streamRef.current) return;

            try {
                console.log('[Camera] Starting shared camera...');
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: "user" }
                });
                streamRef.current = stream;
                if (sharedVideoRef.current) {
                    sharedVideoRef.current.srcObject = stream;
                    await sharedVideoRef.current.play().catch(e => console.error("Shared Video Play Error:", e));
                    console.log('[Camera] Camera active and playing');
                }
            } catch (e) {
                console.error("Shared Camera Error:", e);
            }
        };

        const stopSharedCamera = () => {
            if (streamRef.current) {
                console.log('[Camera] Stopping shared camera...');
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if (sharedVideoRef.current) {
                sharedVideoRef.current.srcObject = null;
            }
        };

        if (isCameraPhase) {
            startSharedCamera();
        } else {
            stopSharedCamera();
        }
    }, [isCameraPhase]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                console.log('[Camera] Cleanup on unmount');
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, []);

    // Focus AI Hook
    const { isAttentive, calibrate, status: aiStatus } = useAttentionAI(
        (phase === 'expanding' || phase === 'focused'), // Active
        sharedVideoRef
    );
    // Force inject the shared ref into the hook's returned ref? 
    // Actually, useAttentionAI returns its own ref. We need to tell it to use OURS.
    // I need to update useAttentionAI to accept videoRef as an ARGUMENT in the hook call.
    // I missed that in the previous step. 
    // Workaround: Assign the shared ref to the hook's ref? No, won't trigger updates.

    // I need to update useAttentionAI signature in the hook file first?
    // Let's assume I did (I modified the file to remove stream logic, but did I change signature?)
    // Checking previous diff: "export function useAttentionAI(active: boolean) {"
    // It does NOT accept videoRef yet. 

    // I will update useAttentionAI signature in the NEXT tool call.
    // For now, I will modify this file assuming the signature is:
    // useAttentionAI(active, videoRef)

    // Wait, I can't modify this file until the hook is ready.
    // I should modify the hook signature first.


    // Expansion animation timing
    useEffect(() => {
        if (phase !== 'expanding') return;
        const timer = setTimeout(() => {
            setPhase('focused');
            calibrate(); // Set strict center when focus mode starts
        }, 800);
        return () => clearTimeout(timer);
    }, [phase, calibrate]);

    // Focus session timer (content viewing phase)
    useEffect(() => {
        if (phase !== 'focused') return;

        const timer = setInterval(() => {
            // Attention Check: Pause timer if looking away
            // Only enforce if AI is ready (graceful degradation)
            if (aiStatus === 'ready' && !isAttentive) {
                return;
            }

            setSessionTime(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // If there's a validation question, transition to question phase
                    if (validationQuestion) {
                        setPhase('question');
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase, isAttentive, aiStatus, validationQuestion]);

    // Question phase timer (grace period)
    useEffect(() => {
        if (phase !== 'question') return;
        const timer = setInterval(() => {
            setQuestionTime(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    const handleAccept = useCallback(() => setPhase('preparing'), []);

    const [paymentResult, setPaymentResult] = useState<any>(null);

    const handleEndSession = useCallback(async () => {
        // If we already have payment result (from "SUBMIT & FINISH"), just close
        if (paymentResult) {
            onAccept();
            return;
        }

        // Show optimistic verifying UI
        setPhase('verifying');

        try {
            // Calculate how long they actually spent
            const actualDuration = initialDuration - sessionTime;
            const exitedEarly = sessionTime > 0; // If timer hasn't hit 0, they exited early

            // Submit match completion with answer
            const result = await api.completeMatch(match.matchId, {
                answer: answer.trim(),
                actualDuration,
                exitedEarly,
                bidId: match.bidId, // Include bidId for x402 orders
                wallet: walletPubkey // Include wallet for fee distribution
            });

            // Handle quality gate responses (200 OK with status field)
            if (result.status === 'rejected') {
                setRejectionMessage(result.message || 'Submission rejected by Quality Control');
                setPhase('rejected');
                return;
            }

            if (result.status === 'banned') {
                setRejectionMessage(result.message || 'Account suspended');
                setPhase('banned');
                return;
            }

            console.log('Match completed successfully:', result);
            setPaymentResult(result); // Store for display
            setPhase('success'); // Move to success phase to show earnings

        } catch (error: any) {
            console.error('Failed to submit match completion:', error);

            // Handle 403 banned response
            if (error?.response?.status === 403) {
                setRejectionMessage('Account suspended for low signal quality');
                setPhase('banned');
                return;
            }

            // Still close modal even if submission fails
            onAccept();
        }
    }, [match.matchId, match.bidId, answer, sessionTime, initialDuration, onAccept, paymentResult, walletPubkey]);

    const getModalStyles = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            backgroundColor: '#0a0a0a',
            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
        };
        if (phase === 'matching' || phase === 'preparing') {
            return { ...base, border: '2px solid #00FF41', borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '90%', boxShadow: '0 0 60px rgba(0,255,65,0.4)' };
        }
        return { ...base, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', maxWidth: '100%', borderRadius: 0, border: 'none', padding: '48px' };
    };

    const renderContent = () => {
        if (failedVerification) {
            return (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
                    <div style={{ color: '#ff4444', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>VERIFICATION FAILED</div>
                    <div style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>Request timed out.</div>
                    <div style={{ color: '#444', fontSize: '12px' }}>Closing session...</div>
                </div>
            );
        }

        // VERIFYING phase - optimistic UI while AI validates
        if (phase === 'verifying') {
            return (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
                    <div style={{ color: '#00FF41', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Success!</div>
                    <div style={{ color: '#888', fontSize: '14px' }}>Verifying your response...</div>
                    <div style={{ width: '60px', height: '60px', border: '3px solid #00FF41', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '24px auto 0' }} />
                </div>
            );
        }

        // REJECTED phase - Quality Control rejection
        if (phase === 'rejected') {
            return (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                    <div style={{ color: '#ff8800', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Low Signal Detected</div>
                    <div style={{ color: '#888', fontSize: '14px', marginBottom: '16px', maxWidth: '400px', margin: '0 auto 16px' }}>
                        This answer was flagged as irrelevant or low-quality. As a result, your Signal Quality Score has dropped. To earn rewards and restore your score, please provide accurate, thoughtful answers.
                    </div>
                    <button onClick={onDismiss} style={{ backgroundColor: '#333', color: 'white', fontWeight: 'bold', padding: '12px 32px', borderRadius: '8px', border: 'none', fontSize: '14px', cursor: 'pointer' }}>I Understand</button>
                </div>
            );
        }

        // BANNED phase - Account suspended
        if (phase === 'banned') {
            return (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
                    <div style={{ color: '#ff4444', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>ACCOUNT SUSPENDED</div>
                    <div style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>{rejectionMessage}</div>
                    <div style={{ color: '#666', fontSize: '12px', marginBottom: '24px' }}>Your Signal Quality score is too low.</div>
                    <button onClick={onDismiss} style={{ backgroundColor: '#ff4444', color: 'white', fontWeight: 'bold', padding: '12px 32px', borderRadius: '8px', border: 'none', fontSize: '14px', cursor: 'pointer' }}>LOG OUT</button>
                </div>
            );
        }
        if (phase === 'matching') {
            return (
                <>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: `4px solid ${countdown <= 3 ? '#ff4444' : '#00FF41'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', fontSize: '32px', fontFamily: 'monospace', color: countdown <= 3 ? '#ff4444' : '#00FF41', fontWeight: 'bold' }}>
                        {countdown}
                    </div>
                    <div style={{ color: '#00FF41', fontSize: '12px', letterSpacing: '2px', marginBottom: '8px' }}>⚡ MATCH DETECTED</div>
                    <h2 style={{ color: 'white', fontSize: '24px', marginBottom: '24px', textAlign: 'center' }}>{topicDisplay}</h2>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', width: '100%' }}>
                        <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>RATE</div>
                            <div style={{ color: '#00FF41', fontSize: '20px', fontFamily: 'monospace' }}>${match.price.toFixed(4)}/s</div>
                        </div>
                        <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>DURATION</div>
                            <div style={{ color: 'white', fontSize: '20px', fontFamily: 'monospace' }}>{match.duration}s</div>
                        </div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span style={{ color: '#888', fontSize: '12px' }}>EST. EARNINGS</span>
                        <span style={{ color: '#00FF41', fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold' }}>${totalEarnings.toFixed(4)}</span>
                    </div>
                    <button onClick={handleAccept} style={{ width: '100%', backgroundColor: '#00FF41', color: 'black', fontWeight: 'bold', padding: '16px', borderRadius: '8px', border: 'none', fontSize: '16px', cursor: 'pointer', marginBottom: '12px' }}>ACCEPT & FOCUS</button>
                    <button onClick={onDismiss} style={{ width: '100%', backgroundColor: 'transparent', color: '#888', padding: '12px', borderRadius: '8px', border: '1px solid #333', fontSize: '12px', cursor: 'pointer' }}>Dismiss Offer</button>
                </>
            );
        }

        if (phase === 'preparing') {
            return (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '120px', fontFamily: 'monospace', fontWeight: 'bold', color: '#00FF41', textShadow: '0 0 40px rgba(0,255,65,0.6)' }}>{prepCountdown}</div>
                    <div style={{ color: '#888', fontSize: '14px', letterSpacing: '4px', marginTop: '16px' }}>PREPARING SESSION...</div>
                </div>
            );
        }

        if (phase === 'liveness') {
            return (
                <LivenessCheck
                    active={true}
                    videoRef={sharedVideoRef}
                    onVerified={() => setPhase('expanding')}
                />
            );
        }

        if (phase === 'expanding') {
            return (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '60px', height: '60px', border: '3px solid #00FF41', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            );
        }

        // Question Phase - Grace period for answering validation question
        if (phase === 'question') {
            // If payment result is available, show confirmation screen
            if (paymentResult) {
                return (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                            <div style={{ color: '#00FF41', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>THANK YOU!</div>
                            <div style={{ backgroundColor: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.3)', borderRadius: '8px', padding: '16px 32px', marginBottom: '8px', display: 'inline-block' }}>
                                <div style={{ color: '#888', fontSize: '10px', letterSpacing: '2px', marginBottom: '4px' }}>YOU EARNED</div>
                                <div style={{ color: '#00FF41', fontSize: '32px', fontFamily: 'monospace', fontWeight: 'bold' }}>${paymentResult.earnedAmount.toFixed(4)}</div>
                            </div>
                            <div style={{ color: '#00FF41', fontSize: '12px', marginBottom: '8px' }}>✅ Payment Confirmed</div>
                            {answer && (
                                <div style={{ color: '#555', fontSize: '12px', marginBottom: '16px' }}>
                                    Your response: "{answer.slice(0, 60)}{answer.length > 60 ? '...' : ''}"
                                </div>
                            )}
                            <div style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Funds released to your wallet!</div>
                            <button onClick={handleEndSession} style={{ backgroundColor: '#00FF41', color: 'black', fontWeight: 'bold', padding: '12px 32px', borderRadius: '8px', border: 'none', fontSize: '14px', cursor: 'pointer' }}>CONTINUE EARNING</button>
                        </div>
                    </div>
                );
            }

            return (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    {/* Top Bar */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ color: '#00FF41', fontSize: '10px', letterSpacing: '2px' }}>SESSION ENDED - ANSWER QUESTION</div>
                            <div style={{ color: questionTime <= 5 ? '#ff4444' : '#888', fontSize: '12px', fontFamily: 'monospace' }}>{questionTime}s</div>
                        </div>
                    </div>

                    {/* Question Card */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 24px' }}>
                        {questionTime > 0 ? (
                            <div style={{ width: '100%', maxWidth: '600px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '32px' }}>
                                <div style={{ color: '#888', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>VALIDATION QUESTION</div>
                                <div style={{ color: 'white', fontSize: '18px', marginBottom: '24px', lineHeight: '1.6' }}>{validationQuestion}</div>
                                <input
                                    type="text"
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    placeholder="Type your answer..."
                                    autoFocus
                                    style={{ width: '100%', backgroundColor: '#0a0a0a', border: '2px solid #00FF41', borderRadius: '8px', padding: '16px', color: 'white', fontSize: '16px', marginBottom: '24px' }}
                                />
                                <button onClick={handleEndSession} style={{ width: '100%', backgroundColor: '#00FF41', color: 'black', fontWeight: 'bold', padding: '16px', borderRadius: '8px', border: 'none', fontSize: '16px', cursor: 'pointer' }}>SUBMIT & FINISH</button>
                            </div>
                        ) : (
                            /* Time's up */
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏱️</div>
                                <div style={{ color: '#ff4444', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>TIME EXPIRED</div>
                                <div style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Question not answered in time</div>
                                <button onClick={handleEndSession} style={{ backgroundColor: '#00FF41', color: 'black', fontWeight: 'bold', padding: '12px 32px', borderRadius: '8px', border: 'none', fontSize: '14px', cursor: 'pointer' }}>RETURN TO DASHBOARD</button>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // Focused phase - Show content (NO validation question here anymore)
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {/* AI Tracking Video (Replaced by Shared Video) */}

                {/* Attention Warning Overlay */}
                {!isAttentive && aiStatus === 'ready' && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 50,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(5px)'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'pulse 1s infinite' }}>👀</div>
                        <div style={{ color: '#ff4444', fontSize: '24px', fontWeight: 'bold', letterSpacing: '2px', textAlign: 'center' }}>
                            ATTENTION LOST
                        </div>
                        <div style={{ color: 'white', marginTop: '8px', fontSize: '14px' }}>
                            Please look at the center of the screen to resume earnings.
                        </div>
                    </div>
                )}

                {/* Top Bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ color: '#00FF41', fontSize: '10px', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', backgroundColor: '#00FF41', borderRadius: '50%' }} />
                            FOCUS MODE
                        </div>
                        <div style={{ color: sessionTime <= 5 ? '#ff4444' : '#888', fontSize: '12px', fontFamily: 'monospace' }}>{sessionTime}s</div>
                    </div>
                    <button onClick={handleEndSession} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '6px 12px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>EXIT</button>
                </div>

                {/* Main Content Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 24px', gap: '24px' }}>
                    {sessionTime > 0 ? (
                        /* Content Display Only */
                        contentUrl ? (
                            <div style={{ maxWidth: '600px', maxHeight: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
                                <img src={contentUrl} alt="Campaign Content" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', opacity: 0.3 }}>
                                <div style={{ color: '#333', fontSize: '14px', letterSpacing: '4px' }}>{topicDisplay.toUpperCase()}</div>
                            </div>
                        )
                    ) : paymentResult ? (
                        /* Session Complete - Payment Confirmed */
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                            <div style={{ color: '#00FF41', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>THANK YOU!</div>
                            <div style={{ backgroundColor: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.3)', borderRadius: '8px', padding: '16px 32px', marginBottom: '8px', display: 'inline-block' }}>
                                <div style={{ color: '#888', fontSize: '10px', letterSpacing: '2px', marginBottom: '4px' }}>YOU EARNED</div>
                                <div style={{ color: '#00FF41', fontSize: '32px', fontFamily: 'monospace', fontWeight: 'bold' }}>${paymentResult.earnedAmount.toFixed(4)}</div>
                            </div>
                            <div style={{ color: '#00FF41', fontSize: '12px', marginBottom: '8px' }}>✅ Payment Confirmed</div>
                            {answer && (
                                <div style={{ color: '#555', fontSize: '12px', marginBottom: '16px' }}>
                                    Your response: "{answer.slice(0, 60)}{answer.length > 60 ? '...' : ''}"
                                </div>
                            )}
                            <div style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Funds released to your wallet!</div>
                            <button onClick={handleEndSession} style={{ backgroundColor: '#00FF41', color: 'black', fontWeight: 'bold', padding: '12px 32px', borderRadius: '8px', border: 'none', fontSize: '14px', cursor: 'pointer' }}>CONTINUE EARNING</button>
                        </div>
                    ) : (
                        /* Loading Payment... */
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '60px', height: '60px', border: '3px solid #00FF41', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                            <div style={{ color: '#888', fontSize: '14px' }}>Processing Payment...</div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: (phase === 'focused' || phase === 'expanding' || phase === 'question') ? '#000' : 'rgba(0,0,0,0.9)', transition: 'background-color 0.8s ease' }}>
            {/* Shared Camera Stream - Always Mounted, Hidden */}
            <video
                ref={sharedVideoRef}
                autoPlay
                playsInline
                muted
                width={640}
                height={480}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -1000 }}
            />

            <div style={getModalStyles()}>
                {renderContent()}
            </div>
        </div>
    );
};
