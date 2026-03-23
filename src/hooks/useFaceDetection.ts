import { useEffect, useRef, useState } from 'react';

// Use any to bypass strict type checking since we removed the static dependency
type FaceDetector = any;

export const useFaceDetection = (
  stream: MediaStream | null,
  active: boolean = true
) => {
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(true); // bias towards true to prevent false alarms before initialization
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const requestRef = useRef<number | null>(null);

  // Initialize the FaceDetector model
  useEffect(() => {
    let isMounted = true;

    const initializeFaceDetector = async () => {
      try {
        // Dynamically import from CDN to bypass Vite module resolution errors with the broken package.json
        const module = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs');
        const { FaceDetector, FilesetResolver } = module as any;

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU"
          },
          runningMode: "VIDEO"
        });

        if (isMounted) {
          faceDetectorRef.current = detector;
          setIsInitialized(true);
        } else {
          detector.close();
        }
      } catch (error) {
        console.error("Error initializing FaceDetector:", error);
      }
    };

    initializeFaceDetector();

    return () => {
      isMounted = false;
      if (faceDetectorRef.current) {
        try {
          faceDetectorRef.current.close();
        } catch (e) {
          console.error("Error closing FaceDetector:", e);
        }
        faceDetectorRef.current = null;
      }
    };
  }, []);

  // Manage an offscreen video element for the stream
  useEffect(() => {
    if (!stream || !active) return;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.warn('Failed to play offscreen video:', e));
    }
    videoRef.current = video;

    return () => {
      video.pause();
      video.srcObject = null;
      video.remove();
      videoRef.current = null;
    };
  }, [stream, active]);

  // Periodic face detection loop
  useEffect(() => {
    if (!active || !isInitialized || !videoRef.current) return;
    
    let isRunning = true;

    const detectFace = () => {
      if (!isRunning) return;

      const detector = faceDetectorRef.current;
      const video = videoRef.current;
      
      // Video must be loaded with dimensions before detection
      if (detector && video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          const startTimeMs = performance.now();
          const results = detector.detectForVideo(video, startTimeMs);
          
          if (results.detections.length > 0) {
            setIsFaceDetected(true);
          } else {
            setIsFaceDetected(false);
          }
        } catch (err) {
          console.error("Error during face detection:", err);
        }
      }
      
      // Check for a face every 1.5 seconds (optimizes battery/cpu compared to requestAnimationFrame)
      requestRef.current = window.setTimeout(detectFace, 1500);
    };

    const startDetection = () => {
      if (requestRef.current) clearTimeout(requestRef.current);
      // Give camera auto-exposure time to stabilize before analyzing frames
      requestRef.current = window.setTimeout(() => {
        if (isRunning) detectFace();
      }, 1500);
    };

    const video = videoRef.current;
    if (video.readyState >= 2) {
      startDetection();
    } else {
      video.addEventListener('playing', startDetection, { once: true });
    }

    return () => {
      isRunning = false;
      if (requestRef.current) clearTimeout(requestRef.current);
      if (video) video.removeEventListener('playing', startDetection);
    };
  }, [active, isInitialized, stream]);

  return isFaceDetected;
};
