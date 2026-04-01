import { useEffect, useRef, useState } from 'react';

// Use any to bypass strict type checking since we removed the static dependency
type FaceDetector = any;
type PoseLandmarker = any;

export const useFaceDetection = (
  stream: MediaStream | null,
  active: boolean = true
) => {
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(true);
  const [isMultiFaceDetected, setIsMultiFaceDetected] = useState<boolean>(false);
  const [isPositionWrong, setIsPositionWrong] = useState<boolean>(false);
  const [positionWarning, setPositionWarning] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const requestRef = useRef<number | null>(null);

  // Initialize the FaceDetector and PoseLandmarker models
  useEffect(() => {
    let isMounted = true;

    const initializeModels = async () => {
      try {
        // Dynamically import from CDN to bypass Vite module resolution errors
        const module = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs');
        const { FaceDetector, PoseLandmarker, FilesetResolver } = module as any;

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        // Face Detector for counting faces
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU"
          },
          runningMode: "VIDEO"
        });

        // Pose Landmarker for head/eye position
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });

        if (isMounted) {
          faceDetectorRef.current = detector;
          poseLandmarkerRef.current = landmarker;
          setIsInitialized(true);
        } else {
          detector.close();
          landmarker.close();
        }
      } catch (error) {
        console.error("Error initializing Proctoring Models:", error);
      }
    };

    initializeModels();

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
      if (poseLandmarkerRef.current) {
        try {
          poseLandmarkerRef.current.close();
        } catch (e) {
          console.error("Error closing PoseLandmarker:", e);
        }
        poseLandmarkerRef.current = null;
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

  // Periodic detection loop
  useEffect(() => {
    if (!active || !isInitialized || !videoRef.current) return;
    
    let isRunning = true;

    const detect = () => {
      if (!isRunning) return;

      const detector = faceDetectorRef.current;
      const landmarker = poseLandmarkerRef.current;
      const video = videoRef.current;
      
      // Video must be loaded with dimensions before detection
      if (detector && landmarker && video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          const startTimeMs = performance.now();
          
          // Face detection for counts
          const faceResults = detector.detectForVideo(video, startTimeMs);
          const faceCount = faceResults.detections.length;
          setIsFaceDetected(faceCount > 0);
          setIsMultiFaceDetected(faceCount > 1);

          // Pose detection for head/eye position
          const poseResults = landmarker.detectForVideo(video, startTimeMs);
          
          if (poseResults.landmarks && poseResults.landmarks.length > 0) {
            const landmarks = poseResults.landmarks[0];
            
            // Pose landmarks: 0: nose, 2: left_eye, 5: right_eye
            const nose = landmarks[0];
            const leftEye = landmarks[2];
            const rightEye = landmarks[5];

            // 1. Calculate key metrics
            const eyeDistance = Math.sqrt(Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2));
            const eyeMidpointX = (leftEye.x + rightEye.x) / 2;
            const eyeMidpointY = (leftEye.y + rightEye.y) / 2;
            
            // Yaw (looking left/right)
            const yawOffset = (nose.x - eyeMidpointX) / eyeDistance;
            
            // Roll (head tilting side to side)
            const rollOffset = Math.abs(leftEye.y - rightEye.y) / eyeDistance;
            
            // Pitch (looking up/down)
            const pitchOffset = (nose.y - eyeMidpointY) / eyeDistance;

            // 2. Classify issues with specific messages
            const IS_YAW_BAD = Math.abs(yawOffset) > 0.45;
            const IS_ROLL_BAD = rollOffset > 0.35;
            const IS_PITCH_BAD = pitchOffset < 0.1 || pitchOffset > 0.6; // Up/down threshold
            const IS_TOO_SMALL = eyeDistance < 0.035;

            if (IS_YAW_BAD) {
              setIsPositionWrong(true);
              setPositionWarning("Head turned sideways. Please look straight at the screen.");
            } else if (IS_ROLL_BAD) {
              setIsPositionWrong(true);
              setPositionWarning("Head tilted too much. Please keep your head straight.");
            } else if (IS_PITCH_BAD) {
              setIsPositionWrong(true);
              setPositionWarning("Looking up or down too much. Please face the screen.");
            } else if (IS_TOO_SMALL) {
              setIsPositionWrong(true);
              setPositionWarning("Eyes not clearly visible. Please ensure you are positioned correctly.");
            } else {
              setIsPositionWrong(false);
              setPositionWarning("");
            }
          } else if (faceCount > 0) {
            // Face detected but pose not clear - might be a positioning issue
             setIsPositionWrong(true);
             setPositionWarning("Head position not clear. Please adjust your posture.");
          } else {
            setIsPositionWrong(false);
            setPositionWarning("");
          }

        } catch (err) {
          console.error("Error during detection:", err);
        }
      }
      
      // Check for a face every 1.5 seconds (optimizes battery/cpu compared to requestAnimationFrame)
      requestRef.current = window.setTimeout(detect, 1500);
    };

    const startDetection = () => {
      if (requestRef.current) clearTimeout(requestRef.current);
      // Give camera auto-exposure time to stabilize before analyzing frames
      requestRef.current = window.setTimeout(() => {
        if (isRunning) detect();
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

  return { isFaceDetected, isMultiFaceDetected, isPositionWrong, positionWarning };
};

