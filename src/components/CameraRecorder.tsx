import React, { useEffect, useRef } from 'react';

interface CameraRecorderProps {
  /** Called when the user denies camera/microphone permission. */
  onPermissionDenied: () => void;
  /** Optional: called with the MediaStream once the camera starts, so a preview popup can consume it. */
  onStream?: (stream: MediaStream) => void;
}

/** How often (in ms) to silently capture a frame during the exam. */
const CAPTURE_INTERVAL_MS = 20000; // 20 seconds

const CameraRecorder: React.FC<CameraRecorderProps> = ({ onPermissionDenied, onStream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    // Guard flag — prevents state updates after the component unmounts.
    let active = true;

    const startCamera = async () => {
      try {
        // Request both camera and microphone access.
        // Audio is captured to detect ambient sounds but not stored — only video frames are saved.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true, // microphone permission requested
        });

        // If the component unmounted while we were waiting for permission, release immediately.
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;

        // Notify parent so the live popup can display the same stream
        onStream?.(stream);

        // Wait for the 'playing' event — this guarantees the browser has actual frame data.
        // Using 'loadedmetadata' is not enough; it fires before frames are decoded.
        video.addEventListener('playing', () => {
          if (!active) return;

          // Brief warmup delay: webcams need ~1.5 s for auto-exposure / white-balance to settle.
          // Capturing too early results in dark or washed-out frames.
          setTimeout(() => {
            if (!active) return;
            captureImage(); // immediate first capture
            intervalRef.current = window.setInterval(captureImage, CAPTURE_INTERVAL_MS);
          }, 1500);
        }, { once: true });

        // Setup Audio Recording
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          console.warn('No audio tracks found. Microphone recording is disabled.');
        } else {
          const audioStream = new MediaStream(audioTracks);
          const startAudioChunk = () => {
            if (!active) return;
            try {
              const options = MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined;
              const mediaRecorder = new MediaRecorder(audioStream, options);
              mediaRecorderRef.current = mediaRecorder;
            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0 && active) {
                chunks.push(e.data);
              }
            };

            mediaRecorder.onstop = () => {
              if (chunks.length > 0 && active) {
                const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                  saveAudio(reader.result as string);
                };
                reader.readAsDataURL(blob);
              }
              // Immediately start the next chunk if still active
              if (active) {
                startAudioChunk();
              }
            };

            mediaRecorder.start();

            // Stop recording after CAPTURE_INTERVAL_MS to finalize the file
            setTimeout(() => {
              if (active && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
              }
            }, CAPTURE_INTERVAL_MS);

          } catch (err) {
            console.warn('Audio recording failed to initialize:', err);
          }
        };

        // Start the continuous loop of discrete audio file recordings
        startAudioChunk();
        }

      } catch (err) {
        console.error('Media device error:', err);
        if (active) onPermissionDenied();
      }
    };

    startCamera();

    // Cleanup: stop all tracks and clear the interval when the component unmounts.
    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onPermissionDenied]);

  /** Draws the current video frame onto the canvas and saves it to localStorage. */
  /**
   * Periodically draws the current video frame to a hidden canvas
   * and converts it to a base64 string to be stored securely.
   */
  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // readyState must be >= 2 (HAVE_CURRENT_DATA) before we can draw a real frame.
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('Video not ready, skipping capture');
      return;
    }

    // Match canvas dimensions to the native video resolution for full-quality captures.
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Sanity check: a blank/black JPEG at this quality is always very small.
    // A real face image with meaningful content will be well above 5 KB.
    if (dataUrl.length < 5000) {
      console.warn('Capture appears blank, skipping save');
      return;
    }

    saveImage(dataUrl);
  };

  /** Appends a captured frame (base64 JPEG) with its timestamp to localStorage. */
  const saveImage = (base64Image: string) => {
    try {
      const existing = JSON.parse(localStorage.getItem('examImages') || '[]');
      existing.push({ timestamp: new Date().toISOString(), image: base64Image });
      localStorage.setItem('examImages', JSON.stringify(existing));
      console.log('Image captured at', new Date().toLocaleTimeString());
    } catch (e) {
      console.error('localStorage save failed (storage may be full):', e);
    }
  };

  /** Appends a recorded audio chunk (base64) with its timestamp to localStorage. */
  const saveAudio = (base64Audio: string) => {
    try {
      const existing = JSON.parse(localStorage.getItem('examAudio') || '[]');
      existing.push({ timestamp: new Date().toISOString(), audio: base64Audio });
      localStorage.setItem('examAudio', JSON.stringify(existing));
      console.log('Audio chunk saved at', new Date().toLocaleTimeString());
    } catch (e) {
      console.error('localStorage Audio save failed:', e);
    }
  };

  // ── Rendering ──────────────────────────────────────────────────────────────
  // Chrome throttles video frame decoding when opacity is near-zero.
  // Solution: render the video at full opacity inside a 1×1 px clipped container.
  // The browser compositor sees it as "visible" and keeps decoding frames,
  // but the student effectively sees nothing (1 px is imperceptible).
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', bottom: 0, right: 0,
        width: '1px', height: '1px',
        overflow: 'hidden', pointerEvents: 'none', zIndex: -1,
      }}
    >
      {/* Video source — kept in DOM at full opacity so the browser renders frames. */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{ width: '160px', height: '120px', display: 'block' }} />

      {/* Off-screen canvas used only for drawing & exporting frames — never shown. */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default CameraRecorder;