# Jozuna Examora - Professional Assessment Portal

Jozuna Examora is a secure, frontend-focused assessment portal designed to conduct highly monitored examinations. It includes robust anti-cheating mechanisms to ensure the integrity of the test environment.

## 📂 Folder Structure

The project follows a scalable and professional React folder structure:

- `src/assets/` - Static assets (images, icons)
- `src/components/` - Reusable UI features (recorders, popups)
- `src/data/` - Static data (mocked exam questions)
- `src/hooks/` - Custom React hooks (e.g., face detection)
- `src/pages/` - Main route components (Login, Dashboard, Exam, Admin)
- `src/types/` - TypeScript interface definitions
- `src/utils/` - Helper functions (auth logic)
- `src/App.tsx` - Main application component & routes
- `src/main.tsx` - Application entry point

## 🧩 Main Modules & Code Explanation

### 1. `Exam.tsx` (Pages)
The core assessment interface. It manages:
- **Test State:** Timer, selected answers, and question navigation.
- **Setup Wizard:** A sequential flow that first requests Camera/Microphone access, then strictly enforces Screen Sharing access.
- **Anti-Cheating Safeguards:** 
  - Mandates Fullscreen mode.
  - Detects tab switching (auto-submits after multiple violations).
  - Enforces cursor bounds (auto-submits if the cursor leaves the window for 30s).
  - Listens for face detection (auto-submits if no face is detected).
  - Disables right-click, copying, and keyboard screenshots.

### 2. `Admin.tsx` (Pages)
A dashboard for administrators/reviewers to verify exam integrity.
- **Media Displays:** Fetches and loops through encoded media stored in `localStorage`.
- **Verifications:** Renders Face Captures, Screen Captures, and Audio snippets with timestamps.

### 3. `CameraRecorder.tsx` (Components)
A background component that secures the visual and auditory environment.
- Captures the user's webcam at a 20-second interval silently using a hidden HTML canvas.
- Simultaneously records background audio chunks.

### 4. `ScreenRecorder.tsx` (Components)
A strict screen-sharing implementation.
- Requests `getDisplayMedia` with a `monitor` surface constraint.
- Rejects any stream where a user attempts to only share a specific application window or browser tab.
- Silently screenshots the shared monitor every 10 seconds.

## 📦 Packages & Dependencies Used

| Package | Purpose |
|---------|---------|
| **`react` & `react-dom`** | The core UI library used for building interactive, state-driven interfaces. |
| **`react-router-dom`** | Handles client-side routing (e.g., `/login`, `/dashboard`, `/exam`, `/admin`). |
| **`lucide-react`** | Provides clean, consistent, and scalable SVG icons used throughout the portal. |
| **`@reduxjs/toolkit`** | *(Installed)* For robust, scalable global state management across the application if needed. |
| **`vite`** | The ultra-fast build tool and development server powering the project. |
| **`typescript`** | Ensures code quality, auto-completion, and fewer runtime errors natively. |

## 🚀 Running the Project
1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Build for production: `npm run build`
