import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CameraRecorder from '../components/CameraRecorder';
import ScreenRecorder from '../components/ScreenRecorder';
import CameraPopup from '../components/CameraPopup';
import { QUESTIONS } from '../data/questions';
import { getUser } from '../utils/auth';
import { 
  AlertTriangle, CheckCircle, XCircle, Clock, Award, RotateCcw, 
  ShieldCheck, Layout, Eye, Ban, MousePointer2 
} from 'lucide-react';
import { useFaceDetection } from '../hooks/useFaceDetection';

/**
 * The duration of the exam measured in seconds.
 * Defauts to 30 minutes.
 */
const EXAM_DURATION_SECONDS = 30 * 60; // 30 minutes

const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

/**
 * Exam Component
 * 
 * This is the central hub for running the examination. It conducts a sequence to:
 * 1. Gather device and strict screen sharing permissions securely.
 * 2. Setup robust visibility and behavioral listeners (tab-switching, cursor-tracking).
 * 3. Render out questions and seamlessly manage grading / end states.
 */
const Exam: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [setupStep, setSetupStep] = useState<'start' | 'camera' | 'screen' | 'ready_to_start' | 'ready'>('start');
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [isScreenStarted, setIsScreenStarted] = useState(false);
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
  const [shortcutViolationCount, setShortcutViolationCount] = useState(0);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [showMobileScreenshotOverlay, setShowMobileScreenshotOverlay] = useState(false);
  const [mobileTab, setMobileTab] = useState<'question' | 'palette'>('question');
  const mobileScreenshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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
    setSetupStep(prev => {
      if (prev === 'ready') {
        recordViolation('screen_sharing_stopped');
        alert('EXAM AUTO-SUBMITTED: Screen sharing was stopped.');
        finishExam();
      } else {
        setScreenPermissionDenied(true);
      }
      return prev;
    });
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
    if (setupStep !== 'ready' || isFinished || permissionDenied || screenPermissionDenied) return;

    if (!isFullscreen && !isMobileDevice) {
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
  }, [isFullscreen, isFinished, permissionDenied, screenPermissionDenied, setupStep]);

  const requestFullscreen = async () => {
    try {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  const startCameraSetup = () => {
    setIsCameraStarted(true);
    setSetupStep('camera');
  };

  const startScreenSetup = () => {
    setIsScreenStarted(true);
  };

  const startExam = async () => {
    await requestFullscreen();
    setSetupStep('ready');
  };

  // ---- Disable right-click + show toast ----
  useEffect(() => {
    const disableContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setShowRightClickToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowRightClickToast(false), 3000);
    };
    document.addEventListener('contextmenu', disableContextMenu);

    // Block printing
    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
      alert('Printing is strictly prohibited during the exam.');
      recordViolation('print_attempt');
    };
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      document.removeEventListener('contextmenu', disableContextMenu);
      window.removeEventListener('beforeprint', handleBeforePrint);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ---- Block Shortcuts / Keyboard / Clipboard ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Block common shortcuts
      const isCopyPaste = ctrlOrMeta && (key === 'c' || key === 'v' || key === 'x');
      const isPrint = ctrlOrMeta && key === 'p';
      const isSave = ctrlOrMeta && key === 's';
      const isViewSource = ctrlOrMeta && key === 'u';
      const isSelectAll = ctrlOrMeta && key === 'a';
      const isFind = ctrlOrMeta && key === 'f';
      const isDevTools = e.key === 'F12' || (ctrlOrMeta && e.shiftKey && (key === 'i' || key === 'j' || key === 'c'));
      const isPrintScreen = e.key === 'PrintScreen' || e.keyCode === 44;
      // Mac specific screenshot shortcuts      const isPrintScreen = e.key === 'PrintScreen' || e.keyCode === 44;
      const isMacScreenshot = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5');
      const isWinSnipping = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S');
      const isWinV = (e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V');
      const isMetaKey = e.key === 'Meta' || e.key === 'OS' || e.key === 'Command' || e.keyCode === 91 || e.keyCode === 92 || e.keyCode === 93;

      if (isCopyPaste || isPrint || isSave || isViewSource || isSelectAll || isFind || isDevTools || isPrintScreen || isMacScreenshot || isWinSnipping || isWinV || isMetaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        setShowScreenshotToast(true);
        if (screenshotToastTimerRef.current) clearTimeout(screenshotToastTimerRef.current);
        screenshotToastTimerRef.current = setTimeout(() => setShowScreenshotToast(false), 3000);
        
        handleShortcutViolation(isMetaKey ? 'meta_key' : (isPrintScreen || isMacScreenshot || isWinSnipping ? 'screenshot' : `shortcut_${key}`));
        
        if (isPrintScreen || isMacScreenshot || isWinSnipping || isMetaKey) {
          navigator.clipboard.writeText(''); // Clear clipboard
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    
    const handleClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      setShowScreenshotToast(true);
      if (screenshotToastTimerRef.current) clearTimeout(screenshotToastTimerRef.current);
      screenshotToastTimerRef.current = setTimeout(() => setShowScreenshotToast(false), 3000);
      handleShortcutViolation(`${e.type}_attempt`);
    };

    window.addEventListener('copy', handleClipboard, true);
    window.addEventListener('cut', handleClipboard, true);
    window.addEventListener('paste', handleClipboard, true);

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        navigator.clipboard.writeText('');
        setShowScreenshotToast(true);
        if (screenshotToastTimerRef.current) clearTimeout(screenshotToastTimerRef.current);
        screenshotToastTimerRef.current = setTimeout(() => setShowScreenshotToast(false), 3000);
        handleShortcutViolation('screenshot_attempt');
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

  // ---- Mobile-specific protections: block copy/paste, long-press, screenshot overlay ----
  useEffect(() => {
    if (!isMobileDevice || setupStep !== 'ready' || isFinished) return;

    // Prevent long-press context menu (iOS Safari shows copy/paste/look-up menu)
    const blockContextMenu = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      setShowScreenshotToast(true);
      if (screenshotToastTimerRef.current) clearTimeout(screenshotToastTimerRef.current);
      screenshotToastTimerRef.current = setTimeout(() => setShowScreenshotToast(false), 3000);
    };

    // Prevent touch-based text selection on long press
    const blockTouchStart = (e: TouchEvent) => {
      // Block multi-touch (potential screenshot gesture on some androids)
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // On some Android browsers a screenshot triggers a very brief visibility change.
    // We flash a black overlay to make the screenshot useless.
    const handleVisibilityForScreenshot = () => {
      if (document.hidden) {
        setShowMobileScreenshotOverlay(true);
        if (mobileScreenshotTimerRef.current) clearTimeout(mobileScreenshotTimerRef.current);
        // Keep overlay up for 1.5s so screenshot captures only black
        mobileScreenshotTimerRef.current = setTimeout(() => {
          setShowMobileScreenshotOverlay(false);
        }, 1500);
      }
    };

    // Block clipboard events (copy / cut / paste) on touch devices
    const blockClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowScreenshotToast(true);
      if (screenshotToastTimerRef.current) clearTimeout(screenshotToastTimerRef.current);
      screenshotToastTimerRef.current = setTimeout(() => setShowScreenshotToast(false), 3000);
      handleShortcutViolation(`mobile_${e.type}_attempt`);
    };

    document.addEventListener('contextmenu', blockContextMenu, { passive: false });
    document.addEventListener('touchstart', blockTouchStart, { passive: false });
    document.addEventListener('visibilitychange', handleVisibilityForScreenshot);
    document.addEventListener('copy', blockClipboard, true);
    document.addEventListener('cut', blockClipboard, true);
    document.addEventListener('paste', blockClipboard, true);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('touchstart', blockTouchStart);
      document.removeEventListener('visibilitychange', handleVisibilityForScreenshot);
      document.removeEventListener('copy', blockClipboard, true);
      document.removeEventListener('cut', blockClipboard, true);
      document.removeEventListener('paste', blockClipboard, true);
      if (mobileScreenshotTimerRef.current) clearTimeout(mobileScreenshotTimerRef.current);
    };
  }, [setupStep, isFinished]);

  useEffect(() => {
    if (setupStep !== 'ready' || isFinished) return;
    
    const clearClipboard = async () => {
      try {
        // Attempt to clear the clipboard
        await navigator.clipboard.writeText(' ');
      } catch (err) {
        // Fails silently if window is blurred, which is expected
      }
    };

    // Periodically clear clipboard every 5 seconds
    const interval = setInterval(clearClipboard, 5000);
    
    const handleFocusLoss = () => {
      setIsBlurred(true);
      clearClipboard();
    };

    const handleFocusGain = () => {
      setIsBlurred(false);
      clearClipboard();
    };

    window.addEventListener('blur', handleFocusLoss);
    window.addEventListener('focus', handleFocusGain);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        handleFocusLoss();
        clearClipboard();
      } else {
        handleFocusGain();
      }
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('blur', handleFocusLoss);
      window.removeEventListener('focus', handleFocusGain);
    };
  }, [setupStep, isFinished]);

  // Timer Effect
  useEffect(() => {
    if (setupStep !== 'ready' || isFinished || permissionDenied || screenPermissionDenied) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); finishExam(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFinished, permissionDenied, screenPermissionDenied, setupStep]);

  // Tab switching prevention and Auto-Submit
  useEffect(() => {
    if (setupStep !== 'ready' || isFinished) return;
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
  }, [isFinished, setupStep]);

  // Face detection warning and Auto-Submit
  useEffect(() => {
    if (setupStep !== 'ready' || isFinished || permissionDenied || screenPermissionDenied || !cameraStream) return;

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
  }, [isFaceDetected, isFinished, permissionDenied, screenPermissionDenied, cameraStream, setupStep]);

  // Mouse leave tracking (Auto-Submit after 30s)
  useEffect(() => {
    if (setupStep !== 'ready' || isFinished) return;
    
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
  }, [isFinished, setupStep]);

  const recordViolation = (type: string) => {
    const violations = JSON.parse(localStorage.getItem('examViolations') || '[]');
    violations.push({ timestamp: new Date().toISOString(), type });
    localStorage.setItem('examViolations', JSON.stringify(violations));
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

  const handleOptionSelect = (questionId: number, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleShortcutViolation = (type: string) => {
    recordViolation(type);
    setShortcutViolationCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 2) {
        alert('EXAM AUTO-SUBMITTED: Forbidden shortcut/screenshot detected multiple times.');
        finishExam();
      } else {
        setShowViolationWarning(true);
      }
      return newCount;
    });
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
  const showOverlay = (!isFullscreen || isBlurred) && setupStep === 'ready' && !isFinished;

  return (
    <div
      className={`exam-layout bg-light no-select ${showOverlay ? 'layout-blurred' : ''}`}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        // Disable iOS touch callout (long-press copy/paste/define menu)
        WebkitTouchCallout: 'none' as any,
        // Remove tap highlight flash on mobile
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Mobile Screenshot Black Overlay */}
      {showMobileScreenshotOverlay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 600 }}>
            🚫 Screenshot Blocked
          </span>
        </div>
      )}
      
      {setupStep !== 'ready' ? (
        <div className="flex-center full-screen bg-light" style={{ position: 'absolute', inset: 0, zIndex: 10000 }}>
          <div className="card max-w-md w-full shadow-lg" style={{ padding: '2.5rem' }}>
            <h2 className="mb-4 text-center">Exam Setup</h2>
            
            {setupStep === 'start' && (
              <>
                <div style={{ textAlign: 'left', background: 'var(--bg-color)', padding: '1.5rem', borderRadius: '0.8rem', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={18} className="text-primary" />
                    Rules & Regulations
                  </h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <li style={{ display: 'flex', gap: '0.75rem' }}>
                      <Layout size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary-color)' }} />
                      <span><strong>Mandatory Fullscreen:</strong> You must remain in fullscreen mode. Exiting for &gt;30s will trigger <strong>auto-submission</strong>.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '0.75rem' }}>
                      <Eye size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary-color)' }} />
                      <span><strong>Continuous Monitoring:</strong> Your Camera, Microphone, and Entire Screen are recorded for proctoring.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '0.75rem' }}>
                      <Ban size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary-color)' }} />
                      <span><strong>Forbidden Actions:</strong> Copy/Paste, Printing, and Screenshots are blocked. Two violations will <strong>terminate</strong> the exam.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '0.75rem' }}>
                      <RotateCcw size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary-color)' }} />
                      <span><strong>No Tab Switching:</strong> Leaving the exam window is strictly prohibited. Warning on 1st/2nd attempt; 3rd is <strong>auto-submit</strong>.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '0.75rem' }}>
                      <MousePointer2 size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary-color)' }} />
                      <span><strong>Cursor Constraints:</strong> Keep your cursor within the window. Leaving for &gt;30s results in <strong>automatic submission</strong>.</span>
                    </li>
                  </ul>
                </div>

                <button onClick={startCameraSetup} className="btn btn-primary btn-lg w-full">
                  Agree & Start Setup
                </button>
              </>
            )}

            {setupStep !== 'start' && (
              <>
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: setupStep === 'camera' ? 'var(--primary-light)' : 'var(--bg-color)', borderRadius: '0.5rem', border: `1px solid ${setupStep === 'camera' ? 'var(--primary-color)' : 'var(--border-color)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: '50%', background: setupStep === 'screen' ? 'var(--success-color)' : 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {setupStep === 'screen' ? '✓' : '1'}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Camera & Microphone</h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Required to verify identity and record audio.</p>
                    </div>
                  </div>
                  {setupStep === 'camera' && permissionDenied && (
                    <div style={{ marginTop: '1rem', color: 'var(--error-color)', fontSize: '0.9rem', padding: '0.75rem', background: 'var(--error-bg)', borderRadius: '0.5rem' }}>
                      Permission denied. Please allow access in your browser site settings and <a href="#" onClick={(e) => { e.preventDefault(); window.location.reload(); }} style={{ textDecoration: 'underline' }}>reload the page</a>.
                    </div>
                  )}
                  {setupStep === 'camera' && !permissionDenied && (
                    <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--primary-color)' }}>
                      Please click "Allow" on the browser permission prompt to proceed...
                    </div>
                  )}
                </div>

                  <div style={{ padding: '1rem', opacity: setupStep === 'camera' ? 0.5 : 1, background: setupStep === 'screen' || setupStep === 'ready_to_start' ? 'var(--primary-light)' : 'var(--bg-color)', borderRadius: '0.5rem', border: `1px solid ${setupStep === 'screen' || setupStep === 'ready_to_start' ? 'var(--primary-color)' : 'var(--border-color)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: '50%', background: setupStep === 'ready_to_start' ? 'var(--success-color)' : setupStep === 'screen' ? 'var(--primary-color)' : 'var(--text-muted)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {setupStep === 'ready_to_start' ? '✓' : '2'}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Screen Sharing</h3>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>You must select <strong>"Entire Screen"</strong>.</p>
                      </div>
                    </div>
                    {setupStep === 'screen' && (
                      <div style={{ marginTop: '1rem' }}>
                        {!isScreenStarted ? (
                          <button onClick={startScreenSetup} className="btn btn-primary w-full">
                            Grant Screen Permission
                          </button>
                        ) : screenPermissionDenied ? (
                          <div style={{ color: 'var(--error-color)', fontSize: '0.9rem', padding: '0.75rem', background: 'var(--error-bg)', borderRadius: '0.5rem' }}>
                            <p style={{ margin: '0 0 0.5rem' }}>Screen sharing was denied or invalid.</p>
                            <button onClick={() => setIsScreenStarted(false)} className="btn btn-primary w-full">Try Again & Select Entire Screen</button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.9rem', color: 'var(--primary-color)' }}>
                            Waiting for screen sharing... Ensure you select "Entire Screen".
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {setupStep === 'ready_to_start' && (
                    <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                      <div className="flex items-center gap-3 justify-center mb-4" style={{ color: 'var(--success-color)' }}>
                         <CheckCircle size={24} />
                         <span style={{ fontWeight: 600 }}>All requirements met!</span>
                      </div>
                      <button onClick={startExam} className="btn btn-primary btn-lg w-full" style={{ background: 'var(--success-color)' }}>
                        Start Exam Now
                      </button>
                    </div>
                  )}
                </>
              )}
          </div>
        </div>
      ) : (
        <>
          {showViolationWarning && (
            <div className="fullscreen-overlay z-[10001]" style={{ background: 'rgba(0,0,0,0.85)' }}>
              <div className="card text-center shadow-lg border-2" style={{ maxWidth: '450px', borderColor: 'var(--error-color)' }}>
                <AlertTriangle size={64} className="mx-auto mb-4" color="var(--error-color)" />
                <h2 className="mb-2" style={{ color: 'var(--error-color)', fontSize: '1.75rem' }}>Security Violation</h2>
                <p className="text-muted mb-4" style={{ fontSize: '1.1rem' }}>
                  Forbidden shortcut (PrintScreen, Ctrl+C, etc.) detected. This is strictly prohibited.
                </p>
                <div style={{ background: 'var(--error-bg)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontWeight: 700, color: 'var(--error-color)', margin: 0 }}>
                    Warning {shortcutViolationCount} of 2 strike(s). Next violation will result in <strong>automatic submission</strong>.
                  </p>
                </div>
                <button onClick={() => setShowViolationWarning(false)} className="btn btn-primary btn-lg w-full">
                  I Understand & Resume
                </button>
              </div>
            </div>
          )}

          {!isFullscreen && setupStep === 'ready' && !isMobileDevice && !isFinished && !permissionDenied && !screenPermissionDenied && (
            <div className="fullscreen-overlay z-[10000]" style={{ background: 'rgba(0,0,0,0.85)' }}>
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

          <div 
            style={{ 
              filter: showOverlay ? 'blur(15px)' : 'none', 
              pointerEvents: showOverlay ? 'none' : 'auto',
              transition: 'filter 0.2s ease-in-out',
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <header className="exam-header shadow-sm">
              <div className="exam-title">
                <h2>Jozuna Assessment</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{attempted}/{totalQuestions} answered</span>
              </div>
              <div className={`timer-badge ${timeLeft < 300 ? 'timer-warning' : ''}`}>
                Time Remaining: {formatTime(timeLeft)}
              </div>
            </header>

            <main className="exam-main-container container" style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem', alignItems: 'flex-start', flex: 1 }}>
        
        {/* Mobile Tab Bar */}
        <div className="mobile-tab-bar">
          <button 
            className={`mobile-tab-btn ${mobileTab === 'question' ? 'active' : ''}`}
            onClick={() => setMobileTab('question')}
          >
            Question {currentQuestionIndex + 1}
          </button>
          <button 
            className={`mobile-tab-btn ${mobileTab === 'palette' ? 'active' : ''}`}
            onClick={() => setMobileTab('palette')}
          >
            Question Palette
          </button>
        </div>

        {/* Left Column: Question Area */}
        <div className={`exam-question-area ${mobileTab === 'palette' ? 'hide-on-mobile' : ''}`} style={{ flex: 1, minWidth: 0 }}>
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
        <div className={`exam-sidebar card shadow-sm ${mobileTab === 'question' ? 'hide-on-mobile' : ''}`} style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '100px' }}>
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
                   onClick={() => {
                     setCurrentQuestionIndex(idx);
                     setMobileTab('question');
                   }}
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
          </div>
        </>
      )}

      {/* Recorders and Popups */}
      {!isFinished && (
        <>
          {/* Always mount CameraRecorder unless finished to keep stream alive */}
          {isCameraStarted && (
            <CameraRecorder
              onPermissionDenied={handlePermissionDenied}
              onStream={(s) => {
                 setCameraStream(s);
                 if ((setupStep as string) === 'camera') setSetupStep('screen');
              }}
            />
          )}
          {/* Mount ScreenRecorder only when requested and in 'screen' or 'ready' setup steps */}
          {isScreenStarted && ((setupStep as string) === 'screen' || (setupStep as string) === 'ready_to_start' || (setupStep as string) === 'ready') && !screenPermissionDenied && (
            <ScreenRecorder
              onPermissionDenied={handleScreenPermissionDenied}
              onReady={() => { if ((setupStep as string) === 'screen') setSetupStep('ready_to_start'); }}
              onStreamStop={handleScreenStreamStop}
            />
          )}
          {((setupStep as string) === 'ready_to_start' || (setupStep as string) === 'ready') && <CameraPopup stream={cameraStream} />}
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
