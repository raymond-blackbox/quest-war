import express from 'express';
import bcrypt from 'bcrypt';
import { getRealtimeDb } from '../services/firebase.js';
import { DIFFICULTY } from '../services/questions.js';

const router = express.Router();

const DEFAULT_TOKEN_PER_CORRECT = 1;
const DEFAULT_TOKEN_PER_WIN = 1;

const sanitizePositiveNumber = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.round(parsed);
};

const sanitizeNonNegativeNumber = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }
    return Math.round(parsed);
};

const resolveDifficulty = (value) => {
    const validValues = Object.values(DIFFICULTY);
    if (typeof value === 'string' && validValues.includes(value.toLowerCase())) {
        return value.toLowerCase();
    }
    return DIFFICULTY.MEDIUM;
};

const DEFAULT_ROUND_SECONDS = 10;

const sanitizeRoomName = (value) => value?.trim();

// POST /api/rooms - Create a new room
router.post('/', async (req, res) => {
    try {
        const {
            name,
            password,
            hostId,
            hostUsername,
            hostDisplayName,
            delaySeconds,
            questionsCount,
            questionDifficulty,
            tokenPerCorrectAnswer,
            tokenPerWin
        } = req.body;

        const trimmedName = sanitizeRoomName(name);
        if (!trimmedName) {
            return res.status(400).json({ error: 'Room name is required' });
        }

        if (trimmedName.length > 15) {
            return res.status(400).json({ error: 'Room name must be 15 characters or less' });
        }

        const resolvedDelaySeconds = sanitizePositiveNumber(delaySeconds, 2);
        const resolvedRoundSeconds = DEFAULT_ROUND_SECONDS;
        const resolvedQuestionsCount = sanitizePositiveNumber(questionsCount, 20);
        const resolvedQuestionDifficulty = resolveDifficulty(questionDifficulty);
        const resolvedTokenPerCorrect = sanitizeNonNegativeNumber(tokenPerCorrectAnswer, DEFAULT_TOKEN_PER_CORRECT);
        const resolvedTokenPerWin = sanitizeNonNegativeNumber(tokenPerWin, DEFAULT_TOKEN_PER_WIN);

        if (!hostId || !hostUsername) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const rtdb = getRealtimeDb();
        const roomRef = rtdb.ref('rooms').push();

        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
        const resolvedHostDisplayName = (hostDisplayName || hostUsername || '').trim() || hostUsername;

        const roomData = {
            name: trimmedName,
            password: hashedPassword,
            isPrivate: !!password,
            hostId,
            hostUsername,
            hostDisplayName: resolvedHostDisplayName,
            settings: {
                delaySeconds: resolvedDelaySeconds,
                roundSeconds: resolvedRoundSeconds,
                questionsCount: resolvedQuestionsCount,
                questionDifficulty: resolvedQuestionDifficulty,
                tokenPerCorrectAnswer: resolvedTokenPerCorrect,
                tokenPerWin: resolvedTokenPerWin
            },
            status: 'waiting',
            hostPassword: password || null,
            players: {
                [hostId]: {
                    username: hostUsername,
                    displayName: resolvedHostDisplayName,
                    ready: false,
                    score: 0,
                    tokensEarned: 0
                }
            },
            createdAt: Date.now()
        };

        await roomRef.set(roomData);

        res.json({
            roomId: roomRef.key,
            ...roomData,
            password: undefined // Don't return hashed password
        });

    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/rooms/:id/join - Join a room
router.post('/:id/join', async (req, res) => {
    try {
        const { id } = req.params;
        const { password, playerId, playerUsername, playerDisplayName } = req.body;

        console.log('Join attempt:', { roomId: id, body: req.body });

        if (!playerId) {
            return res.status(400).json({ error: 'Missing playerId' });
        }
        if (!playerUsername) {
            return res.status(400).json({ error: 'Missing playerUsername' });
        }

        const rtdb = getRealtimeDb();
        const roomRef = rtdb.ref(`rooms/${id}`);
        const snapshot = await roomRef.get();

        if (!snapshot.exists()) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const room = snapshot.val();

        if (room.status !== 'waiting') {
            return res.status(400).json({ error: 'Game already in progress' });
        }

        if (room.isPrivate || room.password) {
            if (!password) {
                return res.status(401).json({ error: 'This room requires a password' });
            }
            const passwordMatch = await bcrypt.compare(password, room.password);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid room password' });
            }
        }

        // Add player to room
        await roomRef.child(`players/${playerId}`).set({
            username: playerUsername,
            displayName: (playerDisplayName || playerUsername || '').trim() || playerUsername,
            ready: false,
            score: 0,
            tokensEarned: 0
        });

        res.json({ success: true, roomId: id });

    } catch (error) {
        console.error('Join room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/rooms/:id/ready - Toggle ready status
router.post('/:id/ready', async (req, res) => {
    try {
        const { id } = req.params;
        const { playerId, ready } = req.body;

        const rtdb = getRealtimeDb();
        const playerRef = rtdb.ref(`rooms/${id}/players/${playerId}`);

        await playerRef.update({ ready });

        res.json({ success: true });

    } catch (error) {
        console.error('Ready toggle error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/rooms/:id/leave - Leave a room
router.post('/:id/leave', async (req, res) => {
    try {
        const { id } = req.params;
        const { playerId } = req.body;

        const rtdb = getRealtimeDb();
        const roomRef = rtdb.ref(`rooms/${id}`);
        const snapshot = await roomRef.get();

        if (!snapshot.exists()) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const room = snapshot.val();

        // Remove player
        await roomRef.child(`players/${playerId}`).remove();

        // If host leaves, delete the room
        if (room.hostId === playerId) {
            await roomRef.remove();
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Leave room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/rooms - List available rooms
router.get('/', async (req, res) => {
    try {
        const rtdb = getRealtimeDb();
        const roomsRef = rtdb.ref('rooms');
        // Fetch all rooms and filter in-memory to avoid index requirements
        const snapshot = await roomsRef.get();

        if (!snapshot.exists()) {
            return res.json([]);
        }

        const rooms = [];
        snapshot.forEach((childSnapshot) => {
            const room = childSnapshot.val();
            if (room.status === 'waiting') {
                rooms.push({
                    id: childSnapshot.key,
                    name: room.name,
                    isPrivate: room.isPrivate || !!room.password,
                    playerCount: Object.keys(room.players || {}).length,
                    hostUsername: room.players[room.hostId]?.displayName || room.players[room.hostId]?.username
                });
            }
        });

        res.json(rooms);

    } catch (error) {
        console.error('List rooms error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
