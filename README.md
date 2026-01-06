# Quest War - Multiplayer Quiz Game

A real-time multiplayer quiz game where players compete to answer questions first.

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express (Cloud Run)
- **Database**: Firebase Realtime Database + Firestore
- **Hosting**: Firebase Hosting

## Project Structure

```
quest-war/
|-- backend/                     # Express API for Cloud Run
|   |-- src/
|   |   |-- config/              # Configuration & Env validation (Zod)
|   |   |-- controllers/         # Request handlers & logic orchestration
|   |   |-- middlewares/         # Auth, Error, and Validation middlewares
|   |   |-- repositories/        # Data access layer (Firestore/RTDB)
|   |   |-- routes/              # API endpoint definitions
|   |   |-- services/            # Core business logic & external integrations
|   |   |-- utils/               # Custom errors & helper utilities
|   |   |-- validations/         # Request schemas (Zod)
|   |   `-- index.js             # Server entry point
|   |-- Dockerfile
|   `-- package.json
|-- frontend/                    # React application (Vite)
|   |-- public/
|   |   |-- assets/              # Character images
|   |   |-- sounds/              # Game audio
|   |   |-- pwa-192x192.png
|   |   |-- pwa-512x512.png
|   |   `-- version.json         # App version + release note
|   |-- src/
|   |   |-- assets/              # Static app assets
|   |   |-- components/          # Reusable UI components
|   |   |-- context/             # Auth context & token syncing
|   |   |-- pages/               # Route screens
|   |   |-- services/            # API client (with Auth) + Firebase helpers
|   |   |-- utils/               # Client utilities
|   |   |-- App.jsx
|   |   |-- App.css
|   |   |-- index.css            # Global tokens + styles
|   |   `-- main.jsx             # App entry
|   |-- index.html
|   |-- vite.config.js
|   `-- package.json
|-- scripts/                     # Initialization scripts
|   `-- init-players.js          # Create test accounts
|-- deploy.ps1
|-- deploy_backend.ps1
|-- deploy_frontend.ps1
|-- firebase.json                # Firebase hosting config
|-- firestore.indexes.json
|-- firestore.rules              # Firestore security
`-- database.rules.json          # RTDB security
```

## Design System

The UI uses a neon, glassmorphism game aesthetic with bold typography, gradients, and motion-driven feedback. Design tokens and shared styles live in `frontend/src/index.css`.

- **Visual theme**: Deep-space background gradient, frosted-glass cards, and glow accents.
- **Color palette**: Primary purple (#8b5cf6), secondary cyan (#06b6d4), accent amber (#f59e0b), plus success/error/warning states.
- **Typography**: Outfit font with heavy-weight, gradient-styled headings and tabular numerals for timers.
- **Core components**: Card layouts, auth toggle, primary/secondary/accent buttons, floating action buttons, modals, and overlays.
- **Game UI**: Player list with ready badges, question cards with a 2x2 answer grid, countdown and result overlays, timer with progress bar.
- **Progression UI**: Quest cards with tags/progress bars and token rewards, plus leaderboard and transactions lists with status styling.
- **Motion and feedback**: Fade/slide/pulse/glow animations, hover lifts, danger shake on timers, and sound effects in `frontend/public/sounds`.
- **Assets**: Character carousel images in `frontend/public/assets` and PWA icons in `frontend/public`.

## Code Design

- **Frontend routing**: `frontend/src/App.jsx` defines protected routes, the global navbar, and login gating.
- **UI composition**: Route screens live in `frontend/src/pages`, reusable widgets in `frontend/src/components`.
- **State and auth**: `frontend/src/context/AuthContext.jsx` owns the player session and syncs the ID token with the API service.
- **API and data**: `frontend/src/services/api.js` is the centralized API client. It automatically includes the `Authorization: Bearer <token>` header for all requests.
- **Styling**: Global tokens and component styles live in `frontend/src/index.css`.
- **Backend architecture**: Follows a clean **Repository -> Service -> Controller** pattern:
    - **Controllers**: Handle HTTP requests/responses.
    - **Services**: Contain core business logic.
    - **Repositories**: Handle all data access (Firestore/Realtime DB).
    - **Middlewares**: Centralized error handling, Zod-based request validation, and Firebase Auth verification.

## Developer Notes (New Contributors)

- **Environment setup**: Copy `frontend/.env.example` to `frontend/.env` and fill in Firebase web config values.
- **Firestore database ID**: The backend and `scripts/init-players.js` target `questwardb`. Update those files if you use a different database ID.
- **API proxy**: Frontend calls `/api/*`, which is proxied to `http://127.0.0.1:3001` in `frontend/vite.config.js`.
- **Versioning**: `frontend/public/version.json` drives the in-app version prompt via `frontend/src/services/version.js`.
- **PWA assets**: Icons in `frontend/public` are wired in `frontend/vite.config.js`.
- **Audio and assets**: Sound effects live in `frontend/public/sounds`, character images in `frontend/public/assets`.
- **Docs**: The root `README.md` is the source of truth; `frontend/README.md` is the Vite template.

## Setup Instructions

### 1. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Realtime Database** and **Firestore**
3. Download your service account key:
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save as `backend/serviceAccountKey.json`

### 2. Configure Environment

Copy the environment template and fill in your Firebase values:

```bash
cd frontend
copy .env.example .env
# Edit .env with your Firebase config from Project Settings > General > Your apps
```

### 3. Run Locally

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Deployment

### Deploy Backend to Cloud Run

```bash
cd backend

# Build and push container
gcloud builds submit --tag gcr.io/YOUR_PROJECT/quest-war-api

# Deploy to Cloud Run
gcloud run deploy quest-war-api \
  --image gcr.io/YOUR_PROJECT/quest-war-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_DATABASE_URL=https://YOUR_PROJECT-default-rtdb.firebaseio.com,FIREBASE_FIRESTORE_DATABASE_ID=questwardb
```

### Deploy Frontend to Firebase Hosting

```bash
cd frontend
npm run build

cd ..
firebase deploy --only hosting
```

## Game Flow

1. **Login**: Sign in with email or Google (email verification required for competitive play).
2. **Lobby**: Browse/filter rooms, open Leaderboard/Quests, or create a new room.
3. **Create/Join Room**: Choose Multiplayer or Solo (Practice), set difficulty and question count, and add an optional password for private rooms.
4. **Room Setup**: Multiplayer players ready up; host can start once all are ready (solo skips ready checks).
5. **Countdown**: A 3-second countdown starts the match.
6. **Rounds**: Each question is timed; the first correct answer reveals the result, otherwise time-up reveals the answer. The next question starts after a short delay.
7. **Scoring & Tokens**: Correct answers earn points; token rewards are tallied during the game and awarded at the end. Solo games do not affect quests or leaderboards.
8. **Game End**: A single winner gets a bonus; ties show as a draw. If everyone disconnects or a player quits, the game can be aborted.
9. **Play Again or Leave**: The host can reset for a new round; others wait or return to the lobby.
