# 🛡️ Examora – Exam Security Features Documentation

> **File:** `src/pages/Exam.tsx`  
> **Last Updated:** 2026-03-26  
> **Audience:** Developers, QA, Management

---

## Overview

Examora implements a multi-layered proctoring system to ensure exam integrity. Security measures are applied at three levels:

| Layer | Mechanism |
|-------|-----------|
| **CSS** | Prevents selection, callout menus, tap highlights |
| **JavaScript / Events** | Blocks keystrokes, clipboard, touch gestures, context menus |
| **React State / Logic** | Tracks violations, triggers warnings, auto-submits exam |

---

## 📋 Table of Contents

1. [Fullscreen Enforcement](#1-fullscreen-enforcement)
2. [Copy / Paste Blocking](#2-copy--paste-blocking)
3. [Screenshot Blocking](#3-screenshot-blocking)
4. [Keyboard Shortcut Blocking](#4-keyboard-shortcut-blocking)
5. [Right-Click / Context Menu Blocking](#5-right-click--context-menu-blocking)
6. [Tab Switching Detection](#6-tab-switching-detection)
7. [Mouse / Cursor Tracking](#7-mouse--cursor-tracking)
8. [Face Detection Monitoring](#8-face-detection-monitoring)
9. [Clipboard Periodic Clearing](#9-clipboard-periodic-clearing)
10. [Print Blocking](#10-print-blocking)
11. [Violation Strike System](#11-violation-strike-system)
12. [Focus / Blur Handling](#12-focus--blur-handling)
13. [Mobile-Specific Protections](#13-mobile-specific-protections)

---

## 1. Fullscreen Enforcement

### 💻 Laptop / Desktop

| Property | Detail |
|----------|--------|
| **Trigger** | Exam becomes active via "Start Exam Now" button |
| **Action** | Calls `requestFullscreen()` / `webkitRequestFullscreen()` / `msRequestFullscreen()` |
| **On Exit** | A countdown overlay appears immediately |
| **Auto-submit timer** | 30 seconds — if not restored, exam is auto-submitted |
| **Validation** | `document.fullscreenElement` is continuously monitored via `fullscreenchange` event |
| **On finish** | `document.exitFullscreen()` is called to release fullscreen |

**Restriction:** Exam content is blurred (`filter: blur(15px)`) and interactions are disabled (`pointer-events: none`) while not in fullscreen.

### 📱 Mobile

| Property | Detail |
|----------|--------|
| **Fullscreen enforcement** | ❌ Skipped (`isMobileDevice` check bypasses fullscreen requirement) |
| **Reason** | Fullscreen API is unreliable/unsupported on most mobile browsers |
| **Compensation** | Screen capture overlay, touch blocking, and face detection remain active |

---

## 2. Copy / Paste Blocking

### 💻 Laptop / Desktop

| Event | Behaviour |
|-------|-----------|
| `copy` | Blocked via `e.preventDefault()` + violation triggered |
| `cut` | Blocked via `e.preventDefault()` + violation triggered |
| `paste` | Blocked via `e.preventDefault()` + violation triggered |
| `Ctrl+C / Ctrl+X / Ctrl+V` | Blocked in `keydown` handler + violation triggered |
| `Meta+C / Meta+V / Meta+X` | Blocked for macOS users |
| **Toast shown** | "📸 Screenshots and copying are disabled" appears for 3 seconds |

All clipboard events are captured with `useCapture: true` (event capture phase) to intercept before the browser handles them.

### 📱 Mobile

| Event | Behaviour |
|-------|-----------|
| `copy` | Blocked via `e.preventDefault()` at document level + violation |
| `cut` | Blocked via `e.preventDefault()` at document level + violation |
| `paste` | Blocked via `e.preventDefault()` at document level + violation |
| **Long-press menu** | Blocked via `contextmenu` event + `-webkit-touch-callout: none` CSS |
| **Text selection** | Blocked via `user-select: none`, `-webkit-user-select: none` (inline style + `.no-select` class) |
| **CSS callout** | `-webkit-touch-callout: none` on `.no-select` — suppresses iOS "Copy / Paste / Define" popup |
| **Tap highlight** | `-webkit-tap-highlight-color: transparent` removes the native blue tap flash |
| **Violation** | `handleShortcutViolation('mobile_copy_attempt')` — counts toward strike system |

---

## 3. Screenshot Blocking

### 💻 Laptop / Desktop

| Method | Detail |
|--------|--------|
| `PrintScreen` key | Blocked on `keydown` + clipboard cleared immediately |
| `PrintScreen` key up | Intercepted on `keyup` + clipboard cleared as secondary measure |
| `Ctrl+Shift+S` (Win Snipping) | Blocked in `keydown` |
| `Cmd+Shift+3/4/5` (Mac) | Blocked in `keydown` |
| Clipboard clear | `navigator.clipboard.writeText('')` called immediately after detection |
| **Violation** | Counts as a strike — 2nd strike = auto-submit |
| **Toast** | "📸 Screenshots and copying are disabled" for 3 seconds |

> **Note:** OS-level screenshot tools (Snipping Tool opened separately, OBS, etc.) cannot be blocked by a browser app. The clipboard is cleared as the primary mitigation.

### 📱 Mobile

| Method | Detail |
|--------|--------|
| **Black overlay** | When `document.visibilityState` becomes `hidden` (triggered briefly on some Android browsers during a screenshot), a full-screen black `div` (`z-index: 999999`) is instantly shown |
| **Overlay duration** | Stays visible for **1500ms** so the captured image is entirely black |
| **Message shown** | "🚫 Screenshot Blocked" displayed in white on black overlay |
| **Multi-touch block** | `touchstart` with `e.touches.length > 1` is blocked — prevents two-finger screenshot gestures (some Android devices) |
| **Limitation** | iOS does not provide any web API signal when a screenshot is taken; overlay method applies only where `visibilitychange` is triggered |

---

## 4. Keyboard Shortcut Blocking

### 💻 Laptop / Desktop

All blocked via `window.addEventListener('keydown', handler, true)` (capture phase):

| Shortcut | Action |
|----------|--------|
| `Ctrl/Meta + C/X/V` | Block copy/cut/paste |
| `Ctrl/Meta + P` | Block print |
| `Ctrl/Meta + S` | Block save-page |
| `Ctrl/Meta + U` | Block view source |
| `Ctrl/Meta + A` | Block select-all |
| `Ctrl/Meta + F` | Block find/search |
| `F12` | Block DevTools |
| `Ctrl+Shift+I/J/C` | Block DevTools (all browsers) |
| `PrintScreen` | Block screenshot |
| `Cmd+Shift+3/4/5` | Block macOS screenshots |
| `Ctrl+Shift+S` / `Win+Shift+S` | Block Windows Snipping Tool |
| `Meta / OS / Command` key alone | Blocked to prevent menu/taskbar access |

**Violation logic:** Any blocked key triggers `handleShortcutViolation()`. 2 strikes = auto-submit.

### 📱 Mobile

| Feature | Status |
|---------|--------|
| Hardware keyboard shortcuts | ✅ Blocked (same `keydown` listener applies if a keyboard is connected) |
| On-screen keyboard shortcuts | N/A (mobile OSes don't expose these to web apps) |
| Copy/paste via touch gestures | ✅ Blocked via clipboard events + context menu block |

---

## 5. Right-Click / Context Menu Blocking

### 💻 Laptop / Desktop

| Property | Detail |
|----------|--------|
| **Event** | `contextmenu` on `document` |
| **Action** | `e.preventDefault()` — browser menu never shows |
| **Toast** | "🚫 Right-click is disabled during the exam" for 3 seconds |
| **Violation logged** | No — right-click is silently blocked without counting as a strike |

### 📱 Mobile

| Property | Detail |
|----------|--------|
| **Event** | `contextmenu` on `document` (fires on long-press on mobile browsers) |
| **Action** | `e.preventDefault()` + `e.stopPropagation()` — popup never shown |
| **Toast** | "📸 Screenshots and copying are disabled" for 3 seconds |
| **Violation logged** | No (treated as a blocked action, not a strike) |

---

## 6. Tab Switching Detection

### 💻 Laptop / Desktop

| Property | Detail |
|----------|--------|
| **Event** | `document.visibilitychange` — `document.hidden === true` |
| **1st + 2nd violation** | `alert()` warning shown: "Warning X of 2. Exam will auto-submit on 3rd." |
| **3rd violation** | Exam auto-submitted immediately |
| **Violation type logged** | `'tab_switch'` in `localStorage.examViolations` |

### 📱 Mobile

Same mechanism applies. Switching apps, pulling down notification shade, or pressing the Home button all trigger `visibilitychange`, which:
1. Increments the tab-switch counter
2. Shows a warning alert
3. Auto-submits on the 3rd occurrence

> **Note:** The black screenshot overlay also fires on visibility change — it is shown for 1.5s regardless, so the tab-switch logic takes precedence for tracking, while the overlay is a passive deterrent.

---

## 7. Mouse / Cursor Tracking

### 💻 Laptop / Desktop

| Property | Detail |
|----------|--------|
| **Events** | `mouseleave` on document, `blur` on window |
| **Trigger condition** | Cursor exits viewport boundary (`clientX/Y` checks) or window loses focus |
| **Auto-submit timer** | 30 seconds of absence triggers auto-submission |
| **Reset** | `mouseenter` or `focus` cancels the timer |
| **Violation type logged** | `'mouse_left_window_long'` |

**Blur/Focus:**
- `blur` → sets `isBlurred: true` + starts 30s cursor timer + blurs exam content
- `focus` → clears timer + removes blur

### 📱 Mobile

| Property | Detail |
|----------|--------|
| **Mouse events** | ❌ Not applicable (no mouse on mobile) |
| **App switching** | Covered by `visibilitychange` (Tab Switching Detection above) |
| **Window blur** | Still tracked — if the browser loses focus the blur overlay is applied |

---

## 8. Face Detection Monitoring

### 💻 Laptop / Desktop

| Property | Detail |
|----------|--------|
| **Library** | `useFaceDetection` custom hook (uses MediaPipe / face-api) |
| **Camera required** | Yes — camera stream must be active |
| **Absence grace period** | 4 seconds — face must be missing for 4+ seconds to trigger |
| **Warning limit** | 3 warnings maximum |
| **Auto-submit** | On the 4th violation |
| **Violation type logged** | `'face_not_detected_warning'` / `'face_not_detected_auto_submit'` |
| **Active during** | `setupStep === 'ready'` and exam is not finished |

### 📱 Mobile

Same face detection logic applies — camera access is requested during setup step, and the `useFaceDetection` hook runs continuously. Mobile cameras (front-facing) are used. The same 4-second grace period and 3-warning limit apply.

---

## 9. Clipboard Periodic Clearing

### 💻 Laptop / Desktop

| Property | Detail |
|----------|--------|
| **Mechanism** | `setInterval` every **5 seconds** calls `navigator.clipboard.writeText(' ')` |
| **Active when** | `setupStep === 'ready'` and exam is not finished |
| **Also clears on** | Window `blur`, window `focus`, and immediately after any screenshot/shortcut detection |
| **Purpose** | Ensures any data copied before or during the exam cannot be retrieved |

### 📱 Mobile

| Property | Detail |
|----------|--------|
| **Clipboard API** | Available on modern Android/iOS browsers (requires `clipboard-write` permission) |
| **Same interval** | 5-second clearing applies if the browser grants permission |
| **Fallback** | If permission is denied, clipboard events are still blocked at the DOM level |

---

## 10. Print Blocking

### 💻 Laptop / Desktop

| Property | Detail |
|----------|--------|
| **Events** | `window.beforeprint` + `Ctrl+P` keydown |
| **Action** | `e.preventDefault()` + `alert('Printing is strictly prohibited')` |
| **Violation logged** | `'print_attempt'` |

### 📱 Mobile

| Property | Detail |
|----------|--------|
| **Browser print** | Rare on mobile, but `beforeprint` event listener is still registered |
| **Share / Save PDF** | Cannot be blocked at the OS level from a web app |

---

## 11. Violation Strike System

### Both Platforms

| Strike | Event |
|--------|-------|
| **1st strike** | Warning modal shown: "Security Violation — Warning 1 of 2" with "I Understand & Resume" button |
| **2nd strike** | `alert()` + exam immediately auto-submitted |
| **Types counted** | PrintScreen, Ctrl+C/V/X, Mac screenshot shortcuts, Win Snipping Tool, mobile copy/paste attempts |
| **Storage** | All violations stored in `localStorage.examViolations` as `[{ timestamp, type }]` array |

**What does NOT count as a strike:**
- Right-click (silently blocked)
- Face detection warnings (separate counter, up to 3)
- Tab switching (separate counter, up to 3)
- Mouse leaving window (timer-based, not strike-based)

---

## 12. Focus / Blur Handling

### 💻 Laptop / Desktop

| State | Behaviour |
|-------|-----------|
| Window blurred | `isBlurred = true` → exam content blurred + 30s mouse-leave timer starts |
| Window focused | `isBlurred = false` → blur removed + timer cleared |
| Visual blur | `filter: blur(15px)` on exam container |
| Interaction | `pointer-events: none` on exam container while blurred |

### 📱 Mobile

| State | Behaviour |
|-------|-----------|
| App backgrounded | `visibilitychange` fires → tracked as tab-switch (see §6) |
| Browser address bar tapped | May trigger `blur` — exam is blurred and 30s timer starts |
| Return to app | `focus` / `visibilitychange` → blur removed |

---

## 13. Mobile-Specific Protections

_These apply **only** when `isMobileDevice === true` (detected via `navigator.userAgent`)._

| Feature | Implementation | Effect |
|---------|----------------|--------|
| Long-press context menu | `contextmenu` event blocked with `passive: false` | iOS/Android copy menu never appears |
| Multi-touch block | `touchstart` with `touches.length > 1` blocked | Prevents two-finger screenshot gestures |
| CSS touch callout | `-webkit-touch-callout: none` on `.no-select` | iOS Safari callout popup suppressed |
| CSS user select | `user-select: none` + `-webkit-user-select: none` | Text cannot be selected or highlighted |
| Tap highlight removal | `-webkit-tap-highlight-color: transparent` | No blue flash on tap |
| Clipboard block | `copy` / `cut` / `paste` blocked with violation | Prevents clipboard access from touch context |
| Screenshot overlay | `visibilitychange` → black fullscreen div for 1500ms | Screenshot captures only black screen |
| Overlay message | "🚫 Screenshot Blocked" in white on black | User is informed of the block |

---

## 🔒 Security Limitations & Honest Disclosure

| Limitation | Platform | Reason |
|------------|----------|--------|
| OS-level screenshots | Both | Web apps have no API to block OS screenshot tools (Snipping Tool, PrtScn on Win, Power+Vol on Android) |
| iOS screenshot detection | iOS | No `visibilitychange` trigger on iOS during screenshot — overlay does not fire |
| Screen recording (OBS, etc.) | Desktop | Cannot be detected or blocked from a browser |
| Clipboard permission denial | Mobile | If browser denies `clipboard-write`, periodic clearing silently fails (copy events still blocked) |
| Rooted/jailbroken devices | Mobile | Bypass of UA detection possible |
| Fullscreen on mobile | Mobile | Fullscreen API not enforced — compensated by other measures |

---

## 📁 Implementation Files

| File | Role |
|------|------|
| `src/pages/Exam.tsx` | Core proctoring logic, all event listeners, violation tracking |
| `src/index.css` | `.no-select`, `-webkit-touch-callout`, `.no-select` CSS |
| `src/hooks/useFaceDetection.ts` | Face detection hook |
| `src/components/CameraRecorder.tsx` | Camera stream setup |
| `src/components/ScreenRecorder.tsx` | Screen sharing setup |
| `src/components/CameraPopup.tsx` | Live camera preview popup |
