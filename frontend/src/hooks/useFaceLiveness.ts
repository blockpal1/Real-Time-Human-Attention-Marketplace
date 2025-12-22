import { useEffect, useState, useRef, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

type ChallengeType = 'smile' | 'blink' | 'tilt';

interface UseFaceLivenessProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    onVerified: () => void;
    active: boolean; // Only run when component is active
}

export const useFaceLiveness = ({ videoRef, onVerified, active }: UseFaceLivenessProps) => {
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [challenge, setChallenge] = useState<ChallengeType>('smile');
    const [progress, setProgress] = useState(0); // 0 to 100
    const [isVerified, setIsVerified] = useState(false);

    // Internal refs
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const lastVideoTimeRef = useRef(-1);
    const requestRef = useRef<number>();
    const progressRef = useRef(0);
    const lastPredictionTimeRef = useRef(0);

    // 1. Initialize MediaPipe FaceLandmarker
    useEffect(() => {
        const initMediaPipe = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
                );

                faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: true,
                    outputFacialTransformationMatrixes: true,
                    runningMode: "VIDEO",
                    numFaces: 1
                });

                setStatus('ready');
                // Pick random challenge
                const challenges: ChallengeType[] = ['smile', 'blink', 'tilt'];
                setChallenge(challenges[Math.floor(Math.random() * challenges.length)]);
                console.log('[Liveness] MediaPipe ready');

            } catch (error) {
                console.error("Failed to init MediaPipe:", error);
                setStatus('error');
            }
        };

        if (active) {
            initMediaPipe();
        }

        return () => {
            if (faceLandmarkerRef.current) {
                faceLandmarkerRef.current.close();
            }
        };
    }, [active]);

    // Challenge checking function
    const checkChallenge = useCallback((blendshapes: any[], landmarks: any[]) => {
        let score = 0;
        let verified = false;

        if (challenge === 'smile') {
            const smileLeft = blendshapes.find((b: any) => b.categoryName === 'mouthSmileLeft')?.score || 0;
            const smileRight = blendshapes.find((b: any) => b.categoryName === 'mouthSmileRight')?.score || 0;
            score = (smileLeft + smileRight) / 2;
            console.log('Smile Score:', score.toFixed(2));
            if (score > 0.2) verified = true;
        }
        else if (challenge === 'blink') {
            const blinkLeft = blendshapes.find((b: any) => b.categoryName === 'eyeBlinkLeft')?.score || 0;
            const blinkRight = blendshapes.find((b: any) => b.categoryName === 'eyeBlinkRight')?.score || 0;
            score = Math.max(blinkLeft, blinkRight);
            console.log('Blink Score:', score.toFixed(2));
            if (score > 0.2) verified = true;
        }
        else if (challenge === 'tilt') {
            if (landmarks && landmarks[33] && landmarks[263]) {
                const leftEye = landmarks[33];
                const rightEye = landmarks[263];
                const dx = rightEye.x - leftEye.x;
                const dy = rightEye.y - leftEye.y;
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                console.log(`[LIVENESS] Tilt Angle: ${angle.toFixed(1)}°`);
                score = Math.min(Math.abs(angle) / 20, 1.0);
                if (Math.abs(angle) > 10 && Math.abs(angle) < 90) verified = true;
            }
        }

        // Smooth progress update
        const targetProgress = verified ? 100 : Math.min(score * 100, 95);
        progressRef.current = progressRef.current + (targetProgress - progressRef.current) * 0.4;
        setProgress(progressRef.current);

        if (verified && progressRef.current > 80) {
            setIsVerified(true);
            // Don't stop camera here - parent controls it
            onVerified();
        }
    }, [challenge, onVerified]);

    // Prediction Loop
    const predictWebcam = useCallback(() => {
        const video = videoRef.current;
        const landmarker = faceLandmarkerRef.current;

        if (!video || !landmarker || isVerified) return;

        // Throttle to ~150ms
        const now = performance.now();
        if (now - lastPredictionTimeRef.current < 150) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }
        lastPredictionTimeRef.current = now;

        // Ensure video is playing
        if (video.currentTime !== lastVideoTimeRef.current && video.videoWidth > 0) {
            lastVideoTimeRef.current = video.currentTime;

            const startTimeMs = performance.now();
            const results = landmarker.detectForVideo(video, startTimeMs);

            if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
                const blendshapes = results.faceBlendshapes[0].categories;
                const landmarks = results.faceLandmarks?.[0] || [];
                checkChallenge(blendshapes, landmarks);
            }
        }

        if (!isVerified) {
            requestRef.current = requestAnimationFrame(predictWebcam);
        }
    }, [videoRef, isVerified, checkChallenge]);

    // 2. Start tracking when video is ready
    useEffect(() => {
        if (!active || !videoRef.current || status !== 'ready' || isVerified) return;

        const videoEl = videoRef.current;

        const startTracking = () => {
            if (videoEl.srcObject && videoEl.readyState >= 2) {
                console.log('[Liveness] Starting prediction loop...');
                predictWebcam();
            }
        };

        // If already playing, start immediately
        if (videoEl.readyState >= 2 && videoEl.srcObject) {
            console.log('[Liveness] Video already ready');
            startTracking();
        } else {
            console.log('[Liveness] Waiting for video...');
            videoEl.addEventListener("loadeddata", startTracking);
            videoEl.addEventListener("canplay", startTracking);
        }

        return () => {
            videoEl.removeEventListener("loadeddata", startTracking);
            videoEl.removeEventListener("canplay", startTracking);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [active, status, isVerified, predictWebcam, videoRef]);

    return {
        status,
        challenge,
        progress,
        isVerified
    };
};
