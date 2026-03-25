import React, { useEffect, useRef, useState } from 'react';

/**
 * CameraPopup — a draggable, live camera preview shown during the exam.
 * The student can drag it anywhere on screen. It does NOT capture/save images
 * (that is handled separately by CameraRecorder). It simply mirrors the live
 * feed from the shared MediaStream passed in via props.
 */
interface CameraPopupProps {
  stream: MediaStream | null;
}

const CameraPopup: React.FC<CameraPopupProps> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // Drag state
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: window.innerWidth - 260, y: window.innerHeight - 220 });
  const [minimized, setMinimized] = useState(false);

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    // Only drag on the header bar
    dragging.current = true;
    const rect = popupRef.current!.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const maxX = window.innerWidth - 240;
      const maxY = window.innerHeight - (minimized ? 50 : 200);
      setPos({
        x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, maxX)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, maxY)),
      });
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [minimized]);

  if (!stream) return null;

  return (
    <div
      ref={popupRef}
      className="cam-popup"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* ── Header / drag handle ─────────────────────────────── */}
      <div className="cam-popup__header" onMouseDown={onMouseDown}>
        <span className="cam-popup__live-dot" />
        <span className="cam-popup__live-label">LIVE</span>
        <span className="cam-popup__title">Camera</span>
        <button
          className="cam-popup__toggle"
          onClick={() => setMinimized(m => !m)}
          title={minimized ? 'Expand' : 'Minimise'}
        >
          {minimized ? '▲' : '▼'}
        </button>
      </div>

      {/* ── Video feed ───────────────────────────────────────── */}
      <div className="cam-popup__body" style={{ display: minimized ? 'none' : 'block' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="cam-popup__video"
        />
      </div>
    </div>
  );
};

export default CameraPopup;
