# MUNINN — The Cognitive Gaze Assistant

**AI-Augmented Personhood Retrieval for Dementia Support**

MUNINN is an Electron desktop prototype that detects when a user is looking at someone on their screen and automatically provides contextual identity reminders. Designed to assist dementia patients and healthcare professionals during digital communication.

## The Recognition Loop

1. **Screen Capture** — Continuously captures the user's display
2. **Face Detection** — Identifies faces on screen using skin-tone analysis
3. **Gaze Tracking** — Estimates where the user is looking via webcam (WebGazer.js)
4. **Dwell Detection** — If gaze rests on a face for >3 seconds, a recognition gap is assumed
5. **Profile Retrieval** — Looks up the linked person profile
6. **AI Note Generation** — Generates a 5-point contextual personhood reminder
7. **Overlay Display** — Shows an unobtrusive overlay with name, relationship, and conversation starters

## Tech Stack

- **Desktop Shell**: Electron
- **Frontend**: React + TypeScript + TailwindCSS
- **Backend**: Express (inside Electron, port 3001)
- **Database**: Firebase Firestore for profile persistence
- **Vision**: Skin-tone face detection, WebGazer.js gaze tracking
- **AI**: Template-based personhood note generator (LLM-ready)

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

The app will launch an Electron window with the MUNINN interface.

On first backend startup, MUNINN seeds the Firestore `profiles` collection automatically. If a local `profiles.json` file already exists, it is used as the one-time migration source before falling back to the built-in seed profiles.

## UI Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Overview of all person profiles with stats |
| **Profile Editor** | Create/edit personhood data (hobbies, emotional anchors, etc.) |
| **Identity Linker** | Manually map faces to person profiles |
| **Live Assistant** | Run the full recognition loop with real-time visualization |

## Features

- **HCP Mode** — Toggle healthcare professional guidance in overlays
- **Biometric Signal** — Simulated heart rate (60–120 BPM); elevated HR prioritizes emotional anchors
- **Gaze Calibration** — 9-point calibration screen for WebGazer.js
- **Seed Profiles** — 4 pre-loaded profiles (Sarah, James, Margaret, Dr. Patel)

## Project Structure

```
muninn/
├── electron/          # Electron main process
│   ├── main.ts        # Window creation, IPC handlers
│   ├── preload.ts     # Context bridge
│   └── overlayWindow.ts
├── frontend/          # React application
│   ├── pages/         # Dashboard, ProfileEditor, IdentityLinker, LiveAssistant
│   ├── components/    # Sidebar, PersonhoodCard, BiometricPanel, etc.
│   └── overlay/       # Transparent overlay window
├── backend/           # Express API server
│   ├── routes/        # Profile CRUD, recognition events
│   ├── services/      # Profile store, AI note generator
│   └── seed.ts        # Sample person profiles
├── vision/            # Computer vision pipeline
│   ├── faceDetection.ts
│   ├── gazeTracking.ts
│   ├── recognitionEngine.ts
│   └── screenCapture.ts
└── shared/types/      # TypeScript interfaces
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profiles` | List all profiles |
| POST | `/api/profiles` | Create a profile |
| PUT | `/api/profiles/:id` | Update a profile |
| DELETE | `/api/profiles/:id` | Delete a profile |
| POST | `/api/recognition-event` | Trigger AI personhood note |
| GET | `/api/health` | Health check |
