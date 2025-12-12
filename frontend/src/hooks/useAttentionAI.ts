import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export function useAttentionAI(active: boolean, externalVideoRef?: React.RefObject<HTMLVideoElement>) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const videoRef = externalVideoRef || localVideoRef;
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const requestRef = useRef<number | null>(null);
    const lastVideoTimeRef = useRef<number>(-1);

    // Calibration State
    const calibrationRef = useRef<{ yaw: number, pitch: number } | null>(null);

    // Public State
    const [isAttentive, setIsAttentive] = useState(true); // Optimistic default
    const [score, setScore] = useState(1.0);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

    // Initialize MediaPipe
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
                    outputFaceBlendshapes: false, // Compatibility mode
                    outputFacialTransformationMatrixes: false,
                    runningMode: "VIDEO",
                    numFaces: 1
                });
                setStatus('ready');
            } catch (error) {
                console.error("Attention AI Init Failed:", error);
                setStatus('error');
            }
        };

        if (!faceLandmarkerRef.current) {
            initMediaPipe();
        }

        return () => {
            if (faceLandmarkerRef.current) {
                faceLandmarkerRef.current.close();
                faceLandmarkerRef.current = null;
            }
        };
    }, []);

    // Calibration Function
    const calibrate = useCallback(() => {
        // Reset calibration to force next frame to set it
        calibrationRef.current = null;
        console.log("Attention System Calibrated: Centering...");
    }, []);

    // Detection Loop
    const predictWebcam = useCallback(() => {
        const video = videoRef.current;
        const landmarker = faceLandmarkerRef.current;

        if (video && landmarker && status === 'ready') {
            if (video.currentTime !== lastVideoTimeRef.current && video.videoWidth > 0) {
                lastVideoTimeRef.current = video.currentTime;

                const startTimeMs = performance.now();
                const results = landmarker.detectForVideo(video, startTimeMs);

                if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                    const landmarks = results.faceLandmarks[0];

                    // Simple Geometry: Head Pose (Yaw/Pitch)
                    // Nose Tip: 1
                    // Left Ear (Outer): 454 (Actually Right in image coords if mirrored? Let's use 234 and 454)
                    // 234: Left side of face (Image Right)
                    // 454: Right side of face (Image Left)

                    const nose = landmarks[1];
                    const leftEar = landmarks[234];
                    const rightEar = landmarks[454];

                    // 1. Calculate Face Width (Ear to Ear)
                    const faceWidth = Math.abs(rightEar.x - leftEar.x);

                    // 2. Yaw (Turn) - Ratio of Nose position between ears
                    // range: 0 (Left Ear) to 1 (Right Ear). Center is ~0.5.
                    const nosePos = nose.x - leftEar.x;
                    const yawRatio = nosePos / faceWidth;

                    // 3. Pitch (Tilt Up/Down) - relative to eye line?
                    // Let's keep simpler logic or rely on Ratio too? 
                    // For Pitch, checking nose Y relative to Ear Y midpoint is okay-ish.
                    const midEarY = (leftEar.y + rightEar.y) / 2;
                    const pitchDiff = nose.y - midEarY;
                    const pitchRatio = pitchDiff / faceWidth;

                    // Calibration
                    if (!calibrationRef.current) {
                        calibrationRef.current = { yaw: yawRatio, pitch: pitchRatio };
                        console.log(`[ATTENTION] Calibrated Center: Yaw=${yawRatio.toFixed(3)}, Pitch=${pitchRatio.toFixed(3)}`);
                    }

                    const center = calibrationRef.current;
                    const deltaYaw = Math.abs(yawRatio - center.yaw);
                    const deltaPitch = Math.abs(pitchRatio - center.pitch);

                    // Thresholds (Tuned)
                    // 0.15 deviation is significant turn (e.g. 0.5 -> 0.65)
                    const YAW_THRESHOLD = 0.10; // Tighten slightly (approx 20 deg)
                    const PITCH_THRESHOLD = 0.15;

                    // console.log(`[DEBUG] dYaw: ${deltaYaw.toFixed(3)} dPitch: ${deltaPitch.toFixed(3)}`);

                    if (deltaYaw > YAW_THRESHOLD || deltaPitch > PITCH_THRESHOLD) {
                        setIsAttentive(false);
                        setScore(0.0);
                    } else {
                        setIsAttentive(true);
                        setScore(1.0);
                    }
                } else {
                    // No face = Not Attentive
                    setIsAttentive(false);
                    setScore(0.0);
                }
            }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [status]);

    // Start/Stop Loop based on 'active' prop
    // NOTE: Camera stream is now managed by the parent (MatchNotificationModal)
    useEffect(() => {
        if (!active || !videoRef.current || status !== 'ready') return;

        const handleVideoReady = () => {
            predictWebcam();
        };

        const videoEl = videoRef.current;
        if (videoEl.readyState >= 2) {
            predictWebcam();
        } else {
            videoEl.addEventListener('loadeddata', handleVideoReady);
            videoEl.addEventListener('play', handleVideoReady);
        }

        return () => {
            videoEl.removeEventListener('loadeddata', handleVideoReady);
            videoEl.removeEventListener('play', handleVideoReady);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [status, active, predictWebcam]);



    return {
        videoRef,
        isAttentive,
        score,
        calibrate,
        status
    };
}
