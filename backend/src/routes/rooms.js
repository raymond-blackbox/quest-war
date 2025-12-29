import express from 'express';
import bcrypt from 'bcrypt';
import { getRealtimeDb } from '../services/firebase.js';
import { getQuestionProvider, GAME_TYPES } from '../services/questionProviders/index.js';
import logger from '../services/logger.js';

// Get the default math provider for validation
const mathProvider = getQuestionProvider(GAME_TYPES.MATH);
const { DIFFICULTY } = mathProvider;

const router = express.Router();

const DEFAULT_TOKEN_PER_CORRECT = 1;
const DEFAULT_TOKEN_PER_WIN = 1;
const SOLO_TOKEN_PER_CORRECT = 1;
const SOLO_TOKEN_PER_WIN = 0;
const MAX_ROOM_PLAYERS = 5;

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
const resolveBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';

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
            tokenPerWin,
            isSolo,
            gameType
        } = req.body;

        const trimmedName = sanitizeRoomName(name);
        if (!trimmedName) {
            return res.status(400).json({ error: 'Room name is required' });
        }

        if (trimmedName.length > 15) {
            return res.status(400).json({ error: 'Room name must be 15 characters or less' });
        }

        const resolvedIsSolo = resolveBoolean(isSolo);
        const resolvedGameType = (gameType && Object.values(GAME_TYPES).includes(gameType)) ? gameType : GAME_TYPES.MATH;
        const resolvedDelaySeconds = sanitizePositiveNumber(delaySeconds, 2);
        const resolvedRoundSeconds = DEFAULT_ROUND_SECONDS;
        const resolvedQuestionsCount = sanitizePositiveNumber(questionsCount, 20);
        const resolvedQuestionDifficulty = resolveDifficulty(questionDifficulty);
        const resolvedTokenPerCorrect = resolvedIsSolo
            ? SOLO_TOKEN_PER_CORRECT
            : sanitizeNonNegativeNumber(tokenPerCorrectAnswer, DEFAULT_TOKEN_PER_CORRECT);
        const resolvedTokenPerWin = resolvedIsSolo
            ? SOLO_TOKEN_PER_WIN
            : sanitizeNonNegativeNumber(tokenPerWin, DEFAULT_TOKEN_PER_WIN);

        if (!hostId || !hostUsername) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const rtdb = getRealtimeDb();
        const roomRef = rtdb.ref('rooms').push();

        const hashedPassword = resolvedIsSolo ? null : (password ? await bcrypt.hash(password, 10) : null);
        const resolvedHostDisplayName = (hostDisplayName || hostUsername || '').trim() || hostUsername;

        const roomData = {
            name: trimmedName,
            password: hashedPassword,
            isPrivate: !resolvedIsSolo && !!password,
            isSolo: resolvedIsSolo,
            hostId,
            hostUsername,
            hostDisplayName: resolvedHostDisplayName,
            settings: {
                delaySeconds: resolvedDelaySeconds,
                roundSeconds: resolvedRoundSeconds,
                questionsCount: resolvedQuestionsCount,
                questionDifficulty: resolvedQuestionDifficulty,
                tokenPerCorrectAnswer: resolvedTokenPerCorrect,
                tokenPerWin: resolvedTokenPerWin,
                gameType: resolvedGameType
            },
            status: 'waiting',
            hostPassword: resolvedIsSolo ? null : (password || null),
            players: {
                [hostId]: {
                    username: hostUsername,
                    displayName: resolvedHostDisplayName,
                    ready: resolvedIsSolo,
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
        logger.error('Create room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/rooms/:id/join - Join a room
router.post('/:id/join', async (req, res) => {
    try {
        const { id } = req.params;
        const { password, playerId, playerUsername, playerDisplayName } = req.body;

        //console.log('Join attempt:', { roomId: id, body: req.body });

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

        const currentPlayers = Object.keys(room.players || {});
        const isAlreadyInRoom = !!room.players?.[playerId];
        if (!isAlreadyInRoom && currentPlayers.length >= MAX_ROOM_PLAYERS) {
            return res.status(409).json({ error: `Room is full (max ${MAX_ROOM_PLAYERS} players)` });
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

        if (room.isSolo && room.hostId !== playerId) {
            return res.status(403).json({ error: 'Solo rooms cannot be joined' });
        }

        const isSoloRoom = room.isSolo === true;
        const isHost = room.hostId === playerId;

        // Add player to room
        await roomRef.child(`players/${playerId}`).set({
            username: playerUsername,
            displayName: (playerDisplayName || playerUsername || '').trim() || playerUsername,
            ready: isSoloRoom && isHost,
            score: 0,
            tokensEarned: 0
        });

        res.json({ success: true, roomId: id });

    } catch (error) {
        logger.error('Join room error:', error);
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
        logger.error('Ready toggle error:', error);
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
        logger.error('Leave room error:', error);
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
            if (room.status === 'waiting' && !room.isSolo) {
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
        logger.error('List rooms error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
