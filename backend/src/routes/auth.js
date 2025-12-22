import express from 'express';
import bcrypt from 'bcrypt';
import { rateLimit } from 'express-rate-limit';
import { getFirestore, admin, getRealtimeDb } from '../services/firebase.js';
import { DistributedRateLimitStore } from '../services/rateLimitStore.js';
import { logTransaction, TRANSACTION_TYPES, TRANSACTION_REASONS } from './transactions.js';

const router = express.Router();

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20, // Limit each IP to 20 requests per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new DistributedRateLimitStore(getRealtimeDb, { prefix: 'rl_auth' }),
    message: { error: 'Too many authentication attempts, please try again after 15 minutes.' }
});

router.use(authLimiter);

const getPlayersCollection = () => getFirestore().collection('players');

const toPlayerResponse = (doc) => {
    const data = doc.data();
    return {
        id: doc.id,
        username: data.username,
        displayName: data.displayName || data.username,
        email: data.email || null,
        tokens: Number(data.tokens || 0)
    };
};

async function findPlayerByField(field, value) {
    const snapshot = await getPlayersCollection()
        .where(field, '==', value)
        .limit(1)
        .get();
    return snapshot.empty ? null : snapshot.docs[0];
}

const normalizeEmail = (email) => {
    if (!email) return null;
    return email.trim().toLowerCase();
};

const sanitizeUsername = (username) => username?.trim();
const sanitizeDisplayName = (value) => value?.trim();
const getDisplayNameKey = (value) => sanitizeDisplayName(value)?.toLowerCase();

function slugifyUsername(source) {
    return (source || '')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 20);
}

async function generateUniqueUsername(baseInput = 'adventurer') {
    const playersRef = getPlayersCollection();
    let base = slugifyUsername(baseInput);
    if (!base || base.length < 3) {
        base = 'adventurer';
    }

    let candidate = base;
    let counter = 1;
    while (counter < 50) {
        const existing = await playersRef.where('username', '==', candidate).limit(1).get();
        if (existing.empty) {
            return candidate;
        }
        candidate = `${base}${counter}`;
        counter += 1;
    }

    return `${base}${Date.now().toString().slice(-4)}`;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
    // Disabled as per user request: Use Google login only
    return res.status(403).json({ error: 'Manual login is disabled. Please use "Sign in with Google".' });
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ error: 'Missing Google ID token' });
        }

        const decoded = await admin.auth().verifyIdToken(idToken);
        const { uid, email, name } = decoded;

        const playersRef = getPlayersCollection();
        let playerDoc = await findPlayerByField('googleUid', uid);

        if (!playerDoc) {
            if (email) {
                const normalizedEmail = normalizeEmail(email);
                const conflictingEmailDoc = await findPlayerByField('email', normalizedEmail);
                if (conflictingEmailDoc && conflictingEmailDoc.data().authProvider !== 'google') {
                    return res.status(409).json({ error: 'Email already linked to a different account' });
                }
            }

            const newUsername = await generateUniqueUsername(name || email || 'adventurer');
            const playerRef = playersRef.doc(uid); // Use Google UID as the document ID
            const fallbackName = name || email || 'Adventurer';
            const resolvedDisplayName = sanitizeDisplayName(fallbackName) || newUsername;
            await playerRef.set({
                username: newUsername,
                displayName: resolvedDisplayName,
                displayNameLower: getDisplayNameKey(resolvedDisplayName) || newUsername.toLowerCase(),
                email: normalizeEmail(email),
                authProvider: 'google',
                googleUid: uid,
                tokens: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            playerDoc = await playerRef.get();
        }

        // Mint custom token with player ID as UID. 
        // For Google users, this now matches their Google UID.
        const firebaseCustomToken = await admin.auth().createCustomToken(playerDoc.id);

        res.json({
            ...toPlayerResponse(playerDoc),
            firebaseCustomToken
        });
    } catch (error) {
        console.error('Google auth error:', error);
        const status = error.code === 'auth/argument-error' ? 400 : 500;
        res.status(status).json({ error: status === 400 ? 'Invalid Google token' : 'Internal server error' });
    }
});

// GET /api/auth/profile/:playerId
router.get('/profile/:playerId', async (req, res) => {
    try {
        const { playerId } = req.params;
        const playerDoc = await getPlayersCollection().doc(playerId).get();

        if (!playerDoc.exists) {
            return res.status(404).json({ error: 'Player not found' });
        }

        res.json(toPlayerResponse(playerDoc));
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/auth/profile/:playerId
router.patch('/profile/:playerId', async (req, res) => {
    try {
        const { playerId } = req.params;
        const { displayName } = req.body;
        const NAME_CHANGE_COST = 500;

        const trimmedDisplayName = sanitizeDisplayName(displayName);
        if (!trimmedDisplayName) {
            return res.status(400).json({ error: 'Display name is required' });
        }

        if (trimmedDisplayName.length < 3 || trimmedDisplayName.length > 12) {
            return res.status(400).json({ error: 'Display name must be between 3 and 12 characters' });
        }

        const displayNameKey = getDisplayNameKey(trimmedDisplayName);
        if (!displayNameKey) {
            return res.status(400).json({ error: 'Display name is invalid' });
        }

        const conflictSnapshot = await getPlayersCollection()
            .where('displayNameLower', '==', displayNameKey)
            .limit(1)
            .get();

        if (!conflictSnapshot.empty && conflictSnapshot.docs[0].id !== playerId) {
            return res.status(409).json({ error: 'Display name already taken' });
        }

        const playerRef = getPlayersCollection().doc(playerId);

        await getFirestore().runTransaction(async (transaction) => {
            const playerDoc = await transaction.get(playerRef);

            if (!playerDoc.exists) {
                throw new Error('Player not found');
            }

            const playerData = playerDoc.data();
            const currentTokens = Number(playerData.tokens || 0);

            // Only charge if the name actually changed
            if (playerData.displayName === trimmedDisplayName) {
                return; // No charge for same name (idempotency), or handle as error? 
                // Usually for UI sync we might just return success, but here let's allow "updating" same name without cost or just skip.
                // Ideally if they submit same name, frontend should catch, but backend should safe guard.
                // Let's assume frontend catches "no changes", but if it hits here, we just update timestamp.
            } else {
                if (currentTokens < NAME_CHANGE_COST) {
                    throw new Error('Insufficient tokens');
                }

                transaction.update(playerRef, {
                    displayName: trimmedDisplayName,
                    displayNameLower: displayNameKey,
                    tokens: currentTokens - NAME_CHANGE_COST,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        // Log spending transaction outside the transaction for simplicity
        // Only logs if name was actually changed (checked above)
        const updatedDoc = await playerRef.get();
        const oldTokens = Number(updatedDoc.data().tokens || 0) + NAME_CHANGE_COST;
        const newTokens = Number(updatedDoc.data().tokens || 0);

        if (oldTokens !== newTokens) {
            await logTransaction(getFirestore(), {
                playerId,
                type: TRANSACTION_TYPES.SPEND,
                amount: NAME_CHANGE_COST,
                reason: TRANSACTION_REASONS.NAME_CHANGE,
                roomId: null
            });
        }

        res.json(toPlayerResponse(updatedDoc));
    } catch (error) {
        console.error('Profile update error:', error);
        if (error.message === 'Player not found') {
            return res.status(404).json({ error: 'Player not found' });
        }
        if (error.message === 'Insufficient tokens') {
            return res.status(402).json({ error: 'Insufficient tokens to change name' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
