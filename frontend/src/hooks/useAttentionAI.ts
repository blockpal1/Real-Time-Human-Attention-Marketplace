import { useEffect, useRef, useState } from 'react';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export function useAttentionAI() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isAttentive, setIsAttentive] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let camera: Camera | null = null;
        let faceMesh: FaceMesh | null = null;

        const onResults = (results: Results) => {
            if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                // Determine attention based on face presence and simple geometry
                // For MVP: If we see a face, you are paying attention.
                // TODO: Add gaze tracking vector for stricter checking
                setIsAttentive(true);
            } else {
                setIsAttentive(false);
            }
        };

        const init = async () => {
            if (!videoRef.current) return;

            try {
                faceMesh = new FaceMesh({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                    }
                });

                faceMesh.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                faceMesh.onResults(onResults);

                if (videoRef.current) {
                    camera = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (videoRef.current && faceMesh) {
                                await faceMesh.send({ image: videoRef.current });
                            }
                        },
                        width: 640,
                        height: 480
                    });

                    await camera.start();
                    setPermissionGranted(true);
                }
            } catch (err: any) {
                console.error("AI Init Error:", err);
                setError(err.message || 'Failed to start camera');
                setPermissionGranted(false);
            }
        };

        init();

        return () => {
            // Cleanup
            if (camera) camera.stop();
            if (faceMesh) faceMesh.close();
        };
    }, []);

    return { videoRef, isAttentive, permissionGranted, error };
}
