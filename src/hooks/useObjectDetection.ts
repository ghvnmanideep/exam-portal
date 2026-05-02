import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// Define the objects that are considered malpractice
const MALPRACTICE_OBJECTS = [
  'cell phone',
  'laptop',
  'tv',
  'remote',
  'book'
];

export const useObjectDetection = (
  stream: MediaStream | null,
  active: boolean = true
) => {
  const [isObjectDetected, setIsObjectDetected] = useState<boolean>(false);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [modelStatus, setModelStatus] = useState<string>('initializing');
  const [debugPredictions, setDebugPredictions] = useState<string>('');

  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const missedFramesRef = useRef<number>(0);
  const detectedClassesRef = useRef<Set<string>>(new Set());

  // Initialize the model
  useEffect(() => {
    let isMounted = true;

    const initializeModel = async () => {
      try {
        setModelStatus('loading tf');
        await tf.ready();
        setModelStatus('loading coco');
        const model = await cocoSsd.load();
        if (isMounted) {
          modelRef.current = model;
          setIsInitialized(true);
          setModelStatus('ready');
        }
      } catch (error: any) {
        console.error("Error initializing Object Detection Model:", error);
        setModelStatus('error: ' + error?.message);
      }
    };

    initializeModel();

    return () => {
      isMounted = false;
      if (modelRef.current) {
        // model.dispose() is not available on coco-ssd, so we just nullify it
        modelRef.current = null;
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
    if (!active || !isInitialized || !videoRef.current || !modelRef.current) return;

    let isRunning = true;

    const detect = async () => {
      if (!isRunning) return;

      const model = modelRef.current;
      const video = videoRef.current;

      if (model && video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        if (!video.width) {
          video.width = video.videoWidth;
          video.height = video.videoHeight;
        }

        try {
          // detect(img, maxNumBoxes, minScore) - using 0.35 score for maximum sensitivity
          const predictions = await model.detect(video, 20, 0.35);
          
          setDebugPredictions(predictions.map(p => `${p.class} (${Math.round(p.score * 100)}%)`).join(', '));
          
          const foundMalpracticeObjects = predictions
            .filter(pred => MALPRACTICE_OBJECTS.includes(pred.class))
            .map(pred => pred.class);

          if (foundMalpracticeObjects.length > 0) {
            missedFramesRef.current = 0;
            setIsObjectDetected(true);
            
            // Add new objects to the current set
            foundMalpracticeObjects.forEach(obj => detectedClassesRef.current.add(obj));
            setDetectedObjects(Array.from(detectedClassesRef.current));
          } else {
            missedFramesRef.current += 1;
            // Tolerate up to 4 missed frames (approx 3.2 seconds) before resetting detection state
            if (missedFramesRef.current > 4) {
              setIsObjectDetected(false);
              detectedClassesRef.current.clear();
              setDetectedObjects([]);
            }
          }
        } catch (err) {
          console.error("Error during object detection:", err);
        }
      }

      // Check for objects more frequently (every 800ms) to ensure continuous detection
      requestRef.current = window.setTimeout(detect, 800);
    };

    const startDetection = () => {
      if (requestRef.current) clearTimeout(requestRef.current);
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

  return { isObjectDetected, detectedObjects, modelStatus, debugPredictions };
};
