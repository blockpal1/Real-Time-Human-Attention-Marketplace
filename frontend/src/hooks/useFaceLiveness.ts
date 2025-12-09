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

    // 2. Start Camera Stream
    useEffect(() => {
        const startCamera = async () => {
            if (!active || !videoRef.current || status !== 'ready') return;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: "user" }
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.addEventListener("loadeddata", predictWebcam);
                }
            } catch (err) {
                console.error("Error accessing webcam:", err);
                setStatus('error');
            }
        };

        startCamera();

        return () => {
            // Stop tracks
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [active, status]);

    // 3. Prediction Loop
    const predictWebcam = useCallback(() => {
        const video = videoRef.current;
        const landmarker = faceLandmarkerRef.current;

        if (!video || !landmarker) return;

        // Throttle to ~150ms
        const now = performance.now();
        if (now - lastPredictionTimeRef.current < 150) {
            if (!isVerified) {
                requestRef.current = requestAnimationFrame(predictWebcam);
            }
            return;
        }
        lastPredictionTimeRef.current = now;

        // Ensure video is playing
        if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;

            const startTimeMs = performance.now();
            const results = landmarker.detectForVideo(video, startTimeMs);

            if (results.faceBlendshapes && results.faceBlendshapes.length > 0 && results.facialTransformationMatrixes) {
                const blendshapes = results.faceBlendshapes[0].categories;
                // const matrix = results.facialTransformationMatrixes[0].data; // Unused now
                const landmarks = results.faceLandmarks[0];

                // Check Challenge Logic
                checkChallenge(blendshapes, landmarks);
            } else {
                console.log("No face detected");
            }
        }

        if (!isVerified) {
            requestRef.current = requestAnimationFrame(predictWebcam);
        }
    }, [challenge, isVerified]);

    const checkChallenge = (blendshapes: any[], landmarks: any[]) => {
        let score = 0;
        let verified = false;

        if (challenge === 'smile') {
            // Check smile related blendshapes
            const smileLeft = blendshapes.find((b: any) => b.categoryName === 'mouthSmileLeft')?.score || 0;
            const smileRight = blendshapes.find((b: any) => b.categoryName === 'mouthSmileRight')?.score || 0;
            score = (smileLeft + smileRight) / 2;
            console.log('Smile Score:', score);
            if (score > 0.3) verified = true;
        }
        else if (challenge === 'blink') {
            const blinkLeft = blendshapes.find((b: any) => b.categoryName === 'eyeBlinkLeft')?.score || 0;
            const blinkRight = blendshapes.find((b: any) => b.categoryName === 'eyeBlinkRight')?.score || 0;
            score = Math.max(blinkLeft, blinkRight); // Blink either eye
            console.log('Blink Score:', score);
            if (score > 0.3) verified = true;
        }
        else if (challenge === 'tilt') {
            // Robust Tilt: Angle between eyes
            // Left Eye Outer: 33, Right Eye Outer: 263
            if (landmarks && landmarks[33] && landmarks[263]) {
                const leftEye = landmarks[33];
                const rightEye = landmarks[263];

                const dx = rightEye.x - leftEye.x;
                const dy = rightEye.y - leftEye.y;
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                console.log('Tilt Angle:', angle);

                // If head is tilted, angle deviates from 0 (or 180?)
                // Let's assume deviation from horizontal (0)
                score = Math.min(Math.abs(angle) / 20, 1.0);
                if (Math.abs(angle) > 10 && Math.abs(angle) < 90) verified = true;
            }
        }

        // Smooth progress update - Faster reaction (0.2)
        const targetProgress = verified ? 100 : Math.min(score * 100, 95);

        // Simple linear interpolation for smoothness
        progressRef.current = progressRef.current + (targetProgress - progressRef.current) * 0.2;

        setProgress(progressRef.current);

        if (verified && progressRef.current > 80) { // Require sustained pose for a bit
            setIsVerified(true);
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
            onVerified();
        }
    };

    return {
        status,
        challenge,
        progress,
        isVerified
    };
};
