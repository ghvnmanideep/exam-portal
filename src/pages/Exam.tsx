import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CameraRecorder from '../components/CameraRecorder';
import ScreenRecorder from '../components/ScreenRecorder';
import CameraPopup from '../components/CameraPopup';
import { QUESTIONS } from '../data/questions';
import { getUser } from '../utils/auth';
import { AlertTriangle, CheckCircle, XCircle, Clock, Award, RotateCcw } from 'lucide-react';
import { useFaceDetection } from '../hooks/useFaceDetection';

const EXAM_DURATION_SECONDS = 30 * 60; // 30 minutes

const Exam: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [screenPermissionDenied, setScreenPermissionDenied] = useState(false);
  const [showRightClickToast, setShowRightClickToast] = useState(false);
  const [showScreenshotToast, setShowScreenshotToast] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [faceWarningCount, setFaceWarningCount] = useState(0);
  const [showFaceWarning, setShowFaceWarning] = useState(false);
  const [fullscreenTimeLeft, setFullscreenTimeLeft] = useState(30);
  const [isBlurred, setIsBlurred] = useState(false);
  
  const isFaceDetected = useFaceDetection(cameraStream, !isFinished && !permissionDenied && !screenPermissionDenied);
  
  const navigate = useNavigate();
  const user = getUser();
  const isFinishedRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenshotToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabSwitchCountRef = useRef(0);
  const mouseLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faceMissingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullscreenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePermissionDenied = React.useCallback(() => {
    setPermissionDenied(true);
  }, []);

  const handleScreenPermissionDenied = React.useCallback(() => {
    setScreenPermissionDenied(true);
  }, []);

  const handleScreenStreamStop = React.useCallback(() => {
    if (isFinishedRef.current) return;
    recordViolation('screen_sharing_stopped');
    alert('EXAM AUTO-SUBMITTED: Screen sharing was stopped.');
    finishExam();
  }, []);

  // ---- Fullscreen enforcement ----
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  // ---- Fullscreen Exit Auto-Submit Timer ----
  useEffect(() => {
    if (isFinished || permissionDenied || screenPermissionDenied) return;

    if (!isFullscreen) {
      setFullscreenTimeLeft(30);
      fullscreenTimerRef.current = setInterval(() => {
        setFullscreenTimeLeft((prev) => {
          if (prev <= 1) {
            if (fullscreenTimerRef.current) clearInterval(fullscreenTimerRef.current);
            recordViolation('fullscreen_exit_auto_submit');
            alert('EXAM AUTO-SUBMITTED: You did not retrieve fullscreen mode within 30 seconds.');
            finishExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setFullscreenTimeLeft(30);
      if (fullscreenTimerRef.current) {
        clearInterval(fullscreenTimerRef.current);
        fullscreenTimerRef.current = null;
      }
    }

    return () => {
      if (fullscreenTimerRef.current) clearInterval(fullscreenTimerRef.current);
    };
  }, [isFullscreen, isFinished, permissionDenied, screenPermissionDenied]);

  const requestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  // ---- Disable right-click + show toast ----
  useEffect(() => {
    const disableContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setShowRightClickToast(true);
      // Clear any existing timer and start a new one
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowRightClickToast(false), 3000);
    };
    document.addEventListener('contextmenu', disableContextMenu);
    return () => {
      document.removeEventListener('contextmenu', disableContextMenu);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ---- Block Screenshots / Keyboard Shortcuts ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Common screenshot and print shortcuts:
      // - PrintScreen key
      // - Ctrl+P or Cmd+P (Print)
      // - Cmd+Shift+3 / 4 / 5 (Mac screenshot)
      // - Win+Shift+S (Windows snipping tool - note: Meta key is often not fully preventable in browsers but we try)
      // - Web dev tools (F12, Ctrl+Shift+I)
      const isMacScreenshot = e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5');
      const isWinSnipping = e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S');
      const isPrint = (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P');
      const isPrintScreen = e.key === 'PrintScreen';
      const isDevTools = e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I'));

      if (isPrintScreen || isMacScreenshot || isWinSnipping || isPrint || isDevTools) {
        e.preventDefault();
        
        // Show screenshot warning toast
        setShowScreenshotToast(true);
        if (screenshotToastTimerRef.current) clearTimeout(screenshotToastTimerRef.current);
        screenshotToastTimerRef.current = setTimeout(() => setShowScreenshotToast(false), 3000);
        
        // Record violation optionally
        recordViolation('screenshot_attempt');
      }
    };

    // Use capturing phase to intercept before other listeners
    window.addEventListener('keydown', handleKeyDown, true);
    
    // Also try to clear clipboard on copy/cut/paste attempt as a fallback
    const handleClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      setShowScreenshotToast(true);
      if (screenshotToastTimerRef.current) clearTimeout(screenshotToastTimerRef.current);
      screenshotToastTimerRef.current = setTimeout(() => setShowScreenshotToast(false), 3000);
      recordViolation(`${e.type}_attempt`);
    };
    window.addEventListener('copy', handleClipboard, true);
    window.addEventListener('cut', handleClipboard, true);
    window.addEventListener('paste', handleClipboard, true);

    // Prevent 'keyup' PrintScreen as well (sometimes only keyup registers for PrintScreen)
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        navigator.clipboard.writeText(''); // Attempt to clear clipboard
        setShowScreenshotToast(true);
        if (screenshotToastTimerRef.current) clearTimeout(screenshotToastTimerRef.current);
        screenshotToastTimerRef.current = setTimeout(() => setShowScreenshotToast(false), 3000);
        recordViolation('screenshot_attempt');
      }
    };
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('copy', handleClipboard, true);
      window.removeEventListener('cut', handleClipboard, true);
      window.removeEventListener('paste', handleClipboard, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      if (screenshotToastTimerRef.current) clearTimeout(screenshotToastTimerRef.current);
    };
  }, []);

  // Timer Effect
  useEffect(() => {
    if (isFinished || permissionDenied || screenPermissionDenied) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); finishExam(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFinished, permissionDenied, screenPermissionDenied]);

  // Tab switching prevention and Auto-Submit
  useEffect(() => {
    if (isFinished) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCountRef.current += 1;
        
        recordViolation('tab_switch');
        
        if (tabSwitchCountRef.current >= 3) {
          alert('EXAM AUTO-SUBMITTED: You have switched tabs too many times.');
          finishExam();
        } else {
          alert(`WARNING: Tab switching is prohibited. Warning ${tabSwitchCountRef.current} of 2. Exam will auto-submit on the 3rd violation.`);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isFinished]);

  // Face detection warning and Auto-Submit
  useEffect(() => {
    if (isFinished || permissionDenied || screenPermissionDenied || !cameraStream) return;

    if (!isFaceDetected) {
      // If face goes missing for 4 continuous seconds
      if (!faceMissingTimerRef.current) {
        faceMissingTimerRef.current = setTimeout(() => {
          setFaceWarningCount(prev => {
             const newCount = prev + 1;
             if (newCount > 3) {
               recordViolation('face_not_detected_auto_submit');
               alert('EXAM AUTO-SUBMITTED: Your face was not detected in the camera frame too many times.');
               finishExam();
             } else {
               recordViolation('face_not_detected_warning');
               setShowFaceWarning(true);
             }
             return newCount;
          });
        }, 4000); 
      }
    } else {
      // Face found again
      if (faceMissingTimerRef.current) {
        clearTimeout(faceMissingTimerRef.current);
        faceMissingTimerRef.current = null;
      }
      setShowFaceWarning(false);
    }
    
    return () => {
      if (faceMissingTimerRef.current) clearTimeout(faceMissingTimerRef.current);
    }
  }, [isFaceDetected, isFinished, permissionDenied, screenPermissionDenied, cameraStream]);

  // Mouse leave tracking (Auto-Submit after 30s)
  useEffect(() => {
    if (isFinished) return;
    
    const triggerMouseLeaveTimer = () => {
      if (mouseLeaveTimerRef.current) return; // Already running
      mouseLeaveTimerRef.current = setTimeout(() => {
        if (!isFinishedRef.current) {
          recordViolation('mouse_left_window_long');
          alert('EXAM AUTO-SUBMITTED: Your cursor/focus was outside the exam window for more than 30 seconds.');
          finishExam();
        }
      }, 30000); // 30 seconds
    };

    const handleMouseLeave = (e: MouseEvent) => {
      // Ensure cursor actually left the main window viewport
      if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight || e.relatedTarget === null) {
         triggerMouseLeaveTimer();
      }
    };

    const handleMouseEnter = () => {
      if (mouseLeaveTimerRef.current) {
        clearTimeout(mouseLeaveTimerRef.current);
        mouseLeaveTimerRef.current = null;
      }
    };
    
    const handleBlur = () => {
      setIsBlurred(true);
      triggerMouseLeaveTimer();
    };
    const handleFocus = () => {
      setIsBlurred(false);
      handleMouseEnter();
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      if (mouseLeaveTimerRef.current) clearTimeout(mouseLeaveTimerRef.current);
    };
  }, [isFinished]);

  const recordViolation = (type: string) => {
    const violations = JSON.parse(localStorage.getItem('examViolations') || '[]');
    violations.push({ timestamp: new Date().toISOString(), type });
    localStorage.setItem('examViolations', JSON.stringify(violations));
  };

  const handleOptionSelect = (questionId: number, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const finishExam = () => {
    isFinishedRef.current = true;
    setIsFinished(true);
    // Exit fullscreen when exam is done
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    localStorage.setItem('examAnswers', JSON.stringify({
      user: user?.email,
      timestamp: new Date().toISOString(),
      answers
    }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ---- Compute results ----
  const totalQuestions = QUESTIONS.length;
  const attempted = Object.keys(answers).length;
  const correct = QUESTIONS.filter(q => answers[q.id] === q.correctAnswer).length;
  const wrong = attempted - correct;
  const skipped = totalQuestions - attempted;
  const percentage = Math.round((correct / totalQuestions) * 100);

  const getGrade = () => {
    if (percentage >= 90) return { label: 'Excellent', color: '#10b981', bg: '#d1fae5' };
    if (percentage >= 75) return { label: 'Good', color: '#3b82f6', bg: '#dbeafe' };
    if (percentage >= 50) return { label: 'Average', color: '#f59e0b', bg: '#fef3c7' };
    return { label: 'Needs Improvement', color: '#ef4444', bg: '#fef2f2' };
  };

  // ---- Permission denied screen ----
  if (permissionDenied || screenPermissionDenied) {
    return (
      <div className="flex-center full-screen bg-light">
        <div className="card text-center max-w-sm">
          <AlertTriangle size={48} style={{ color: 'var(--error-color)', margin: '0 auto 1rem' }} />
          <h2 className="mb-2">Permissions Required</h2>
          <p className="text-muted mb-4">
            You must allow both camera and ENTIRE SCREEN sharing access to take this exam. Please enable permissions in your browser and reload. Be sure to select "Entire Screen".
          </p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">Try Again</button>
        </div>
      </div>
    );
  }

  // ---- Results screen ----
  if (isFinished) {
    const grade = getGrade();
    return (
      <div className="bg-light min-h-screen" style={{ padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>

          {/* Header card */}
          <div className="bg-white rounded-lg shadow-sm" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: grade.bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 1rem'
            }}>
              <Award size={40} style={{ color: grade.color }} />
            </div>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem' }}>Exam Completed!</h2>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
              {user?.name} · Frontend Developer Assessment
            </p>

            {/* Score circle */}
            <div style={{
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
              background: grade.bg, borderRadius: '1rem', padding: '1.25rem 2.5rem', marginBottom: '1.5rem'
            }}>
              <span style={{ fontSize: '3rem', fontWeight: 700, color: grade.color, lineHeight: 1 }}>{percentage}%</span>
              <span style={{ fontSize: '0.85rem', color: grade.color, fontWeight: 600, marginTop: '0.25rem' }}>
                {correct} / {totalQuestions} correct
              </span>
              <span style={{
                marginTop: '0.5rem', background: grade.color, color: 'white',
                fontSize: '0.75rem', fontWeight: 700, padding: '2px 12px', borderRadius: '999px'
              }}>
                {grade.label}
              </span>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { icon: <CheckCircle size={18} color="#10b981" />, label: 'Correct', value: correct, color: '#10b981', bg: '#d1fae5' },
                { icon: <XCircle size={18} color="#ef4444" />, label: 'Wrong', value: wrong, color: '#ef4444', bg: '#fef2f2' },
                { icon: <Clock size={18} color="#6b7280" />, label: 'Skipped', value: skipped, color: '#6b7280', bg: '#f3f4f6' },
              ].map(stat => (
                <div key={stat.label} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: stat.bg, borderRadius: '0.75rem', padding: '0.75rem 1.25rem', minWidth: '90px'
                }}>
                  {stat.icon}
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color, lineHeight: 1.2 }}>{stat.value}</span>
                  <span style={{ fontSize: '0.75rem', color: stat.color }}>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Answer Review */}
          <div className="bg-white rounded-lg shadow-sm" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600 }}>Answer Review</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {QUESTIONS.map((q, idx) => {
                const userAnswer = answers[q.id];
                const isCorrect = userAnswer === q.correctAnswer;
                const isSkipped = userAnswer === undefined;
                return (
                  <div key={q.id} style={{
                    border: `1px solid ${isCorrect ? '#a7f3d0' : isSkipped ? '#e5e7eb' : '#fecaca'}`,
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '0.65rem 1rem',
                      background: isCorrect ? '#f0fdf4' : isSkipped ? '#f9fafb' : '#fef2f2',
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem'
                    }}>
                      {isSkipped
                        ? <Clock size={16} color="#9ca3af" style={{ flexShrink: 0, marginTop: '2px' }} />
                        : isCorrect
                          ? <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                          : <XCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-muted)', marginRight: '0.4rem' }}>Q{idx + 1}.</span>{q.text}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem' }}>
                          {!isSkipped && (
                            <span style={{
                              padding: '2px 10px', borderRadius: '999px',
                              background: isCorrect ? '#d1fae5' : '#fecaca',
                              color: isCorrect ? '#065f46' : '#991b1b', fontWeight: 500
                            }}>
                              Your answer: {q.options[userAnswer]}
                            </span>
                          )}
                          {!isCorrect && (
                            <span style={{
                              padding: '2px 10px', borderRadius: '999px',
                              background: '#d1fae5', color: '#065f46', fontWeight: 500
                            }}>
                              Correct: {q.options[q.correctAnswer]}
                            </span>
                          )}
                          {isSkipped && (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not answered</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
              Return to Dashboard
            </button>
            <button
              onClick={() => { setAnswers({}); setIsFinished(false); setTimeLeft(EXAM_DURATION_SECONDS); }}
              className="btn"
              style={{ border: '1px solid var(--border-color)', background: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RotateCcw size={16} /> Retake Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Exam screen ----
  return (
    <div className={`exam-layout bg-light no-select ${isBlurred ? 'blurred-view' : ''}`} style={{ userSelect: 'none', WebkitUserSelect: 'none', filter: isBlurred ? 'blur(10px)' : 'none', transition: 'filter 0.1s ease-in-out' }}>
      
      {!isFullscreen && !isFinished && !permissionDenied && !screenPermissionDenied && (
        <div className="fullscreen-overlay z-[9999]" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="card text-center shadow-lg border-2" style={{ maxWidth: '400px', borderColor: 'var(--error-color)' }}>
            <AlertTriangle size={48} className="icon-warning mx-auto mb-4" color="var(--error-color)" />
            <h2 className="mb-2" style={{ color: 'var(--error-color)' }}>Fullscreen Required</h2>
            <p className="text-muted mb-4">
              The exam must be taken in fullscreen mode. Please return to fullscreen immediately.
            </p>
            <div style={{ background: 'var(--error-bg)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
              <p style={{ fontWeight: 700, color: 'var(--error-color)', fontSize: '1.25rem', margin: 0 }}>
                Auto-submit in: {fullscreenTimeLeft}s
              </p>
            </div>
            <button onClick={requestFullscreen} className="btn btn-primary btn-lg w-full">
              Enter Fullscreen & Resume
            </button>
          </div>
        </div>
      )}

      <header className="exam-header shadow-sm">
        <div className="exam-title">
          <h2>Jozuna Assessment</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{attempted}/{totalQuestions} answered</span>
        </div>
        <div className={`timer-badge ${timeLeft < 300 ? 'timer-warning' : ''}`}>
          Time Remaining: {formatTime(timeLeft)}
        </div>
      </header>

      <main className="exam-main-container container" style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem', alignItems: 'flex-start' }}>
        
        {/* Left Column: Question Area */}
        <div className="exam-question-area" style={{ flex: 1, minWidth: 0 }}>
          <div className="card question-card mb-6 shadow-sm" style={{ minHeight: '350px' }}>
            <h3 className="question-text" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <span className="question-number" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </span> 
              <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{QUESTIONS[currentQuestionIndex].text}</span>
            </h3>
            <div className="options-list">
              {QUESTIONS[currentQuestionIndex].options.map((opt, oIndex) => (
                <label
                  key={oIndex}
                  className={`option-label ${answers[QUESTIONS[currentQuestionIndex].id] === oIndex ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`question-${QUESTIONS[currentQuestionIndex].id}`}
                    value={oIndex}
                    checked={answers[QUESTIONS[currentQuestionIndex].id] === oIndex}
                    onChange={() => handleOptionSelect(QUESTIONS[currentQuestionIndex].id, oIndex)}
                    className="sr-only-radio"
                  />
                  <div className="radio-custom"></div>
                  <span className="option-text">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="exam-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '1rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setCurrentQuestionIndex(p => Math.max(0, p - 1))} 
              className="btn btn-secondary"
              disabled={currentQuestionIndex === 0}
              style={{ opacity: currentQuestionIndex === 0 ? 0.5 : 1 }}
            >
              Previous
            </button>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  const newAnswers = { ...answers };
                  delete newAnswers[QUESTIONS[currentQuestionIndex].id];
                  setAnswers(newAnswers);
                }}
                className="btn btn-secondary"
                style={{ color: 'var(--error-color)', borderColor: 'var(--error-bg)' }}
              >
                Clear Response
              </button>
              
              {currentQuestionIndex < totalQuestions - 1 ? (
                <button onClick={() => setCurrentQuestionIndex(p => p + 1)} className="btn btn-primary">
                  Save & Next
                </button>
              ) : (
                <button onClick={finishExam} className="btn btn-primary" style={{ background: 'var(--success-color)' }}>
                  Submit Exam
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Question Palette Sidebar */}
        <div className="exam-sidebar card shadow-sm" style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '100px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Question Palette</h3>
          </div>
          
          <div className="palette-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
             {QUESTIONS.map((q, idx) => {
               const isAnswered = answers[q.id] !== undefined;
               const isCurrent = idx === currentQuestionIndex;
               return (
                 <button
                   key={q.id}
                   onClick={() => setCurrentQuestionIndex(idx)}
                   className={`palette-btn ${isAnswered ? 'answered' : 'unanswered'} ${isCurrent ? 'current' : ''}`}
                   title={`Go to Question ${idx + 1}`}
                 >
                   {idx + 1}
                 </button>
               )
             })}
          </div>

          <div className="palette-legend" style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <div className="palette-btn answered" style={{ width: '24px', height: '24px', minWidth: '24px', fontSize: '0' }}></div> Answered
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <div className="palette-btn unanswered" style={{ width: '24px', height: '24px', minWidth: '24px', fontSize: '0' }}></div> Not Answered
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <div className="palette-btn current" style={{ width: '24px', height: '24px', minWidth: '24px', fontSize: '0' }}></div> Current
             </div>
          </div>
        </div>
      </main>

      {!isFinished && !permissionDenied && !screenPermissionDenied && (
        <>
          <CameraRecorder
            onPermissionDenied={handlePermissionDenied}
            onStream={setCameraStream}
          />
          <ScreenRecorder
            onPermissionDenied={handleScreenPermissionDenied}
            onStreamStop={handleScreenStreamStop}
          />
          <CameraPopup stream={cameraStream} />
        </>
      )}

      {/* Right-click & Screenshot blocked toasts */}
      <div className={`right-click-toast ${showRightClickToast ? 'right-click-toast--visible' : ''}`}>
        <span className="right-click-toast__icon">🚫</span>
        Right-click is disabled during the exam
      </div>

      <div className={`right-click-toast ${showScreenshotToast ? 'right-click-toast--visible' : ''}`}>
        <span className="right-click-toast__icon">📸</span>
        Screenshots and copying are disabled
      </div>

      {/* Face Detection Warning Modal */}
      {showFaceWarning && (
        <div className="fullscreen-overlay z-[9999]" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="card text-center shadow-lg border-2" style={{ maxWidth: '450px', borderColor: 'var(--error-color)' }}>
            <AlertTriangle size={64} className="mx-auto mb-4" color="var(--error-color)" />
            <h2 className="mb-2" style={{ color: 'var(--error-color)', fontSize: '1.75rem' }}>Face Not Detected</h2>
            <p className="text-muted mb-4" style={{ fontSize: '1.1rem' }}>
              We cannot detect your face in the camera feed. Please return to the camera view immediately to continue your exam.
            </p>
            <div style={{ background: 'var(--error-bg)', padding: '1rem', borderRadius: '0.5rem', marginTop: '1.5rem' }}>
              <p style={{ fontWeight: 700, color: 'var(--error-color)', margin: 0 }}>
                Warning {faceWarningCount} of 3
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--error-color)', marginTop: '0.5rem', marginBottom: 0 }}>
                The exam will automatically submit on the 4th violation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exam;
