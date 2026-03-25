import React, { useEffect, useRef } from 'react';

/**
 * Props for the ScreenRecorder component.
 */
interface ScreenRecorderProps {
  /** Called when the user dismisses the screen recording permission prompt or selects an invalid screen surface. */
  onPermissionDenied: () => void;
  /** Called if the active screen sharing stream is unexpectedly stopped. */
  onStreamStop?: () => void;
  /** Fired when the "Entire Screen" has been successfully verified and is streaming. */
  onReady?: () => void;
}

/** 
 * Interval at which a silent screenshot of the screen is captured and stored. 
 */
const CAPTURE_INTERVAL_MS = 10000; // 10 seconds

let globalScreenStreamPromise: Promise<MediaStream> | null = null;
let activeRecorders = 0;

/**
 * ScreenRecorder Component
 * 
 * A background component designed to capture the user's screen at a fixed interval.
 * It enforces proper exam conditions by verifying that the user selects the "Entire Screen" option.
 */
const ScreenRecorder: React.FC<ScreenRecorderProps> = ({ onPermissionDenied, onStreamStop, onReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    activeRecorders++;

    const startScreenShare = async () => {
      try {
        // --- MOBILE/UNSUPPORTED FALLBACK ---
        // 'getDisplayMedia' is not supported on mobile browsers (iOS Safari, Android Chrome).
        // If the user is on mobile, we gracefully bypass screen recording so they can take the exam.
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          console.warn('Screen sharing is not supported on this device. Bypassing screen record step.');
          if (active && onReady) {
            onReady();
          }
          return;
        }
        // -----------------------------------

        if (!globalScreenStreamPromise) {
          globalScreenStreamPromise = navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'monitor' },
            audio: false,
          });
        }

        const stream = await globalScreenStreamPromise;

        if (!active) {
          return;
        }

        const videoTrack = stream.getVideoTracks()[0];

        // Strict check to ensure the user shared the entire screen
        const settings = videoTrack.getSettings();
        if (settings.displaySurface && settings.displaySurface !== 'monitor') {
          // If we fail the strict check, we stop tracks and reset the global promise
          stream.getTracks().forEach((t) => t.stop());
          globalScreenStreamPromise = null;
          alert('You MUST share your "Entire Screen" for the exam. Windows or chrome tabs are not allowed.');
          if (active) onPermissionDenied();
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;

        if (active && onReady) {
          onReady();
        }

        if (videoTrack) {
          const handleEnded = () => {
            globalScreenStreamPromise = null;
            if (active && onStreamStop) onStreamStop();
          };
          videoTrack.addEventListener('ended', handleEnded);
        }

        video.addEventListener('playing', () => {
          if (!active) return;
          setTimeout(() => {
            if (!active) return;
            captureImage();
            intervalRef.current = window.setInterval(captureImage, CAPTURE_INTERVAL_MS);
          }, 1500);
        }, { once: true });

      } catch (err) {
        console.error('Screen sharing error:', err);
        globalScreenStreamPromise = null;
        if (active) onPermissionDenied();
      }
    };

    startScreenShare();

    return () => {
      active = false;
      activeRecorders--;
      if (intervalRef.current) clearInterval(intervalRef.current);

      // Delay stopping the stream to allow React 18 Strict Mode remount
      setTimeout(() => {
        if (activeRecorders === 0 && globalScreenStreamPromise) {
          globalScreenStreamPromise.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => { });
          globalScreenStreamPromise = null;
        }
      }, 500);
    };
  }, [onPermissionDenied, onStreamStop]);

  /**
   * Captures the current frame of the hidden video element and pushes it to local storage.
   */
  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    if (dataUrl.length < 5000) {
      return;
    }

    saveImage(dataUrl);
  };

  /**
   * Parses the stringified base64 image and saves it securely along with a timestamp to localStorage.
   * 
   * @param base64Image The image raw representation.
   */
  const saveImage = (base64Image: string) => {
    try {
      const existing = JSON.parse(localStorage.getItem('examScreenCaptures') || '[]');
      existing.push({ timestamp: new Date().toISOString(), image: base64Image });
      localStorage.setItem('examScreenCaptures', JSON.stringify(existing));
      console.log('Screen captured at', new Date().toLocaleTimeString());
    } catch (e) {
      console.error('localStorage save failed for screen captures:', e);
    }
  };

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', bottom: 0, right: 0,
        width: '1px', height: '1px',
        overflow: 'hidden', pointerEvents: 'none', zIndex: -1,
      }}
    >
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '160px', height: '120px', display: 'block' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default ScreenRecorder;
