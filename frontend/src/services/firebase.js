import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, off, query, orderByChild, equalTo, onDisconnect, set, remove } from 'firebase/database';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCustomToken, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';

// Firebase configuration - replace with your project config
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://quest-war-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Real-time database helpers
export function subscribeToRoom(roomId, callback) {
    const roomRef = ref(database, `rooms/${roomId}`);
    onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            callback({ id: roomId, ...snapshot.val() });
        } else {
            callback(null);
        }
    });
    return roomRef;
}

export function subscribeToLobbyRooms(callback) {
    const roomsRef = ref(database, 'rooms');
    const waitingRoomsQuery = query(roomsRef, orderByChild('status'), equalTo('waiting'));

    onValue(waitingRoomsQuery, (snapshot) => {
        console.log('[FIREBASE] Lobby snapshot received. Exists:', snapshot.exists());
        if (!snapshot.exists()) {
            callback([]);
            return;
        }

        const rooms = [];
        snapshot.forEach((childSnapshot) => {
            const room = childSnapshot.val();

            // Filter out rooms where host is disconnected
            // Legacy rooms might not have 'connected' property, assume true for them
            // Only exclude if explicitly false
            const hostData = room.players?.[room.hostId];

            if (!hostData) {
                console.log(`[FIREBASE] Room ${childSnapshot.key} filtered out. HostData missing.`);
                return;
            }
            if (room.isSolo) {
                return;
            }

            // Query guarantees status === 'waiting', but we keep the mapping logic
            rooms.push({
                id: childSnapshot.key,
                name: room.name,
                isPrivate: room.isPrivate || !!room.password,
                playerCount: Object.keys(room.players || {}).length,
                hostUsername: hostData?.displayName || hostData?.username,
                questionDifficulty: room.settings?.questionDifficulty,
                gameType: room.settings?.gameType || 'math',
                createdAt: room.createdAt
            });
        });

        callback(rooms);
    });
    return waitingRoomsQuery;
}

export function unsubscribeFromRoom(roomRef) {
    off(roomRef);
}

export async function signInWithCustomAuthToken(token) {
    return signInWithCustomToken(auth, token);
}

export async function signInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    console.log('[GOOGLE AUTH DEBUG] Signed in user:', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName
    });
    const idToken = await result.user.getIdToken();

    return {
        idToken,
        profile: {
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL
        }
    };
}

export async function registerWithEmail(email, password) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await result.user.getIdToken();
    return { idToken };
}

export async function loginWithEmail(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await result.user.getIdToken();
    return { idToken, user: result.user };
}

export async function sendVerificationEmail() {
    if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
    }
}

export async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
}

export { auth, database, ref, onValue, off, onDisconnect, set, remove };
