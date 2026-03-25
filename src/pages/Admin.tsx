import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Camera, Mic, Clock, Download, Image as ImageIcon, Monitor } from 'lucide-react';
import { getMedia, clearAllMedia } from '../utils/storage';

interface CapturedImage {
  timestamp: string;
  image: string; // Base64
}

interface CapturedAudio {
  timestamp: string;
  audio: string; // Base64
}

const Admin: React.FC = () => { 
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [screenCaptures, setScreenCaptures] = useState<CapturedImage[]>([]);
  const [audios, setAudios] = useState<CapturedAudio[]>([]);
  const [selected, setSelected] = useState<CapturedImage | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadImages();
    loadScreenCaptures();
    loadAudios();
  }, []);

  const loadImages = async () => {
    const indexedData = await getMedia<CapturedImage>('examImages');
    const stored = localStorage.getItem('examImages');
    const legacyData = stored ? JSON.parse(stored) : [];
    setImages([...legacyData, ...indexedData]);
  };

  const loadScreenCaptures = async () => {
    const indexedData = await getMedia<CapturedImage>('examScreenCaptures');
    const stored = localStorage.getItem('examScreenCaptures');
    const legacyData = stored ? JSON.parse(stored) : [];
    setScreenCaptures([...legacyData, ...indexedData]);
  };

  const loadAudios = async () => {
    const indexedData = await getMedia<CapturedAudio>('examAudio');
    const stored = localStorage.getItem('examAudio');
    const legacyData = stored ? JSON.parse(stored) : [];
    setAudios([...legacyData, ...indexedData]);
  };

  const clearImages = async () => {
    if (window.confirm('Are you sure you want to clear all captured media?')) {
      await clearAllMedia();
      localStorage.removeItem('examImages');
      localStorage.removeItem('examScreenCaptures');
      localStorage.removeItem('examAudio');
      setImages([]);
      setScreenCaptures([]);
      setAudios([]);
    }
  };

  const downloadImage = (img: CapturedImage, idx: number) => {
    const a = document.createElement('a');
    a.href = img.image;
    a.download = `capture-${idx + 1}-${new Date(img.timestamp).toISOString().replace(/[:.]/g, '-')}.jpg`;
    a.click();
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], { dateStyle: 'medium' });
  };

  return (
    <div className="layout-container bg-light min-h-screen">
      {/* Lightbox */}
      {selected && (
        <div onClick={() => setSelected(null)}
          style={{position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',padding: '1rem',}}>
          <img
            src={selected.image}
            alt="Full size capture"
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '0.75rem', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          />
          <div style={{ position: 'absolute', bottom: '2rem', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
            {formatDate(selected.timestamp)} at {formatTime(selected.timestamp)} — Click anywhere to close
          </div>
        </div>
      )}

      <nav className="navbar shadow-sm sticky top-0 bg-white z-10">
        <div className="navbar-brand">
          <button onClick={() => navigate('/dashboard')} className="btn-icon mr-2">
            <ArrowLeft size={20} />
          </button>
          <Camera size={20} className="icon-primary" />
          <h2 style={{ margin: 0, fontWeight: 600 }}>Exam Captures</h2>
        </div>
        <div className="navbar-user" style={{ gap: '0.75rem' }}>
          {(images.length > 0 || screenCaptures.length > 0) && (
            <span className="badge" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
              {images.length + screenCaptures.length} capture{images.length + screenCaptures.length !== 1 ? 's' : ''}
            </span>
          )}
          {(images.length > 0 || screenCaptures.length > 0 || audios.length > 0) && (
            <button onClick={clearImages} className="btn-icon flex items-center gap-2" style={{ color: 'var(--error-color)' }}>
              <Trash2 size={16} /> Clear All
            </button>
          )}
        </div>
      </nav>

      <main style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

        {/* Access instructions card */}
        <div style={{
          background: 'white', borderRadius: '0.75rem', padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem', borderLeft: '4px solid var(--primary-color)',
          boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'flex-start', gap: '1rem',
        }}>
          <ImageIcon size={20} style={{ color: 'var(--primary-color)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 0.25rem' }}>How to access captures</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              During the exam, a photo is silently captured every <strong>15 seconds</strong>. Images are saved in your browser's local storage.
              To view them: navigate to <strong>/admin</strong> after the exam, or click <strong>View Captures</strong> on the Dashboard. Click any image to enlarge it.
            </p>
          </div>
        </div>

        {/* Face Camera Captures Section */}
        <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera size={20} className="icon-primary" />
          Face Camera Captures
        </h3>

        {images.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem 2rem',
            background: 'white', borderRadius: '0.75rem',
            border: '2px dashed var(--border-color)',
          }}>
            <Camera size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No images captured yet</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Start an exam session to begin capturing face images automatically.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1.25rem',
          }}>
            {images.map((img, idx) => (
              <div key={idx} style={{
                background: 'white', borderRadius: '0.75rem',
                overflow: 'hidden', border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.2s, transform 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
              >
                {/* Clickable image */}
                <div
                  onClick={() => setSelected(img)}
                  style={{ cursor: 'zoom-in', position: 'relative', overflow: 'hidden', aspectRatio: '16/9', background: '#000' }}
                >
                  <img
                    src={img.image}
                    alt={`Capture ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  />
                  <div style={{
                    position: 'absolute', top: '0.5rem', left: '0.5rem',
                    background: 'rgba(0,0,0,0.55)', color: 'white',
                    fontSize: '0.7rem', fontWeight: 700,
                    padding: '2px 8px', borderRadius: '999px',
                  }}>
                    #{idx + 1}
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  padding: '0.65rem 0.85rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderTop: '1px solid var(--border-color)',
                  background: 'var(--bg-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <Clock size={12} />
                    {formatDate(img.timestamp)} · {formatTime(img.timestamp)}
                  </div>
                  <button
                    onClick={() => downloadImage(img, idx)}
                    title="Download image"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--primary-color)', padding: '0.25rem', borderRadius: '0.25rem',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Screen Captures Section */}
        <h3 style={{ marginTop: '2.5rem', marginBottom: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Monitor size={20} className="icon-primary" />
          Screen Captures
        </h3>
        
        {screenCaptures.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem 2rem',
            background: 'white', borderRadius: '0.75rem',
            border: '2px dashed var(--border-color)',
          }}>
            <Monitor size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No screen captures yet</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Start an exam session to begin capturing screen images automatically.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1.25rem',
          }}>
            {screenCaptures.map((img, idx) => (
              <div key={idx} style={{
                background: 'white', borderRadius: '0.75rem',
                overflow: 'hidden', border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.2s, transform 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
              >
                {/* Clickable image */}
                <div
                  onClick={() => setSelected(img)}
                  style={{ cursor: 'zoom-in', position: 'relative', overflow: 'hidden', aspectRatio: '16/9', background: '#000' }}
                >
                  <img
                    src={img.image}
                    alt={`Screen Capture ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  />
                  <div style={{
                    position: 'absolute', top: '0.5rem', left: '0.5rem',
                    background: 'rgba(0,0,0,0.55)', color: 'white',
                    fontSize: '0.7rem', fontWeight: 700,
                    padding: '2px 8px', borderRadius: '999px',
                  }}>
                    #{idx + 1}
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  padding: '0.65rem 0.85rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderTop: '1px solid var(--border-color)',
                  background: 'var(--bg-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <Clock size={12} />
                    {formatDate(img.timestamp)} · {formatTime(img.timestamp)}
                  </div>
                  <button
                    onClick={() => downloadImage(img, idx)}
                    title="Download capture"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--primary-color)', padding: '0.25rem', borderRadius: '0.25rem',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Audio Recordings Section */}
        <h3 style={{ marginTop: '2.5rem', marginBottom: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Mic size={20} className="icon-primary" />
          Microphone Recordings
        </h3>
        
        {audios.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '3rem 2rem',
            background: 'white', borderRadius: '0.75rem',
            border: '2px dashed var(--border-color)',
          }}>
            <Mic size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No audio recorded yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {audios.map((a, idx) => (
              <div key={idx} style={{
                background: 'white', border: '1px solid var(--border-color)', borderRadius: '0.75rem',
                padding: '1rem 1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Audio Snippet #{idx + 1}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <Clock size={14} />
                    {formatDate(a.timestamp)} · {formatTime(a.timestamp)}
                  </div>
                </div>
                <audio controls src={a.audio} style={{ flexShrink: 0 }} />
                <button
                    onClick={() => {
                       const link = document.createElement('a');
                       link.href = a.audio;
                       link.download = `audio-capture-${idx + 1}.webm`;
                       link.click();
                    }}
                    title="Download audio"
                    className="btn-icon"
                    style={{ color: 'var(--primary-color)' }}
                  >
                    <Download size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;
