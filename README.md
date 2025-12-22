# Quest War - Multiplayer Math Quiz Game

A real-time multiplayer quiz game where players compete to answer math questions first.

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express (Cloud Run)
- **Database**: Firebase Realtime Database + Firestore
- **Hosting**: Firebase Hosting

## Project Structure

```
quest-war/
├── backend/               # Express API for Cloud Run
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Firebase, questions
│   │   └── index.js      # Server entry
│   ├── Dockerfile
│   └── package.json
├── frontend/             # React application
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── services/     # Firebase, API
│   │   └── context/      # Auth context
│   └── package.json
├── scripts/              # Initialization scripts
│   └── init-players.js   # Create test accounts
├── firebase.json         # Firebase config
├── firestore.rules       # Firestore security
└── database.rules.json   # RTDB security
```

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

### 3. Initialize Player Accounts

```bash
cd scripts
npm install
node init-players.js
```

This creates 5 test accounts: `play1` / `play1pass` through `play5` / `play5pass`

### 4. Run Locally

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

1. **Login**: Players login with pre-generated accounts
2. **Create/Join Room**: Host creates a room with settings, others join with password
3. **Ready Up**: All players must click ready
4. **Game Start**: Host starts the game, 3-second countdown
5. **Answer Questions**: First correct answer wins the round
6. **Results**: Winner shown after each question
7. **Game End**: Winner receives 1 token, leaderboard updated

## Test Credentials

| Username | Password |
|----------|----------|
| play1    | play1pass |
| play2    | play2pass |
| play3    | play3pass |
| play4    | play4pass |
| play5    | play5pass |
