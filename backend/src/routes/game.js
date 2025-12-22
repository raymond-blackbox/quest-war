import express from 'express';
import { getRealtimeDb, getFirestore } from '../services/firebase.js';
import { generateQuestion, DIFFICULTY } from '../services/questions.js';
import { logTransaction, TRANSACTION_TYPES, TRANSACTION_REASONS } from './transactions.js';

const router = express.Router();

// Store active game intervals
const gameIntervals = new Map();

// Rate limiting handled by global limiter

const DEFAULT_TOKEN_PER_CORRECT = 1;
const DEFAULT_TOKEN_PER_WIN = 1;
const TOKEN_CONFIG_CACHE_MS = 60 * 1000;

const DEFAULT_REWARD_BY_DIFFICULTY = {
    [DIFFICULTY.EASY]: { tokenPerCorrect: 1, tokenPerWin: 10 },
    [DIFFICULTY.MEDIUM]: { tokenPerCorrect: 2, tokenPerWin: 20 },
    [DIFFICULTY.HARD]: { tokenPerCorrect: 3, tokenPerWin: 30 }
};

const resolveTokenValue = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }
    return Math.round(parsed);
};

async function awardTokens(db, playerId, playerLabel, tokenDelta, reason = 'Quest Reward', roomId = null) {
    if (!playerId || tokenDelta <= 0) return;

    const playerDocRef = db.collection('players').doc(playerId);
    const playerDoc = await playerDocRef.get();

    if (!playerDoc.exists) return;

    const currentTokens = Number(playerDoc.data().tokens || 0);
    const newTokens = currentTokens + tokenDelta;
    await playerDocRef.update({ tokens: newTokens });

    const resolvedDisplayName = playerLabel || playerDoc.data().displayName || playerDoc.data().username;
    const resolvedUsername = playerDoc.data().username;

    // Get current totalTokensEarned from leaderboard, then add the delta
    const leaderboardDocRef = db.collection('leaderboard').doc(playerId);
    const leaderboardDoc = await leaderboardDocRef.get();
    const currentTotalEarned = Number(leaderboardDoc.exists ? leaderboardDoc.data().totalTokensEarned || 0 : 0);

    await leaderboardDocRef.set({
        username: resolvedUsername,
        displayName: resolvedDisplayName,
        tokens: newTokens,
        totalTokensEarned: currentTotalEarned + tokenDelta, // Lifetime earnings - only increases
        updatedAt: new Date()
    }, { merge: true });

    // Log the transaction
    await logTransaction(db, {
        playerId,
        type: TRANSACTION_TYPES.EARN,
        amount: tokenDelta,
        reason,
        roomId
    });
}


const tokenRewardsCache = {
    data: null,
    fetchedAt: 0
};

const normalizeDifficulty = (difficulty) => {
    if (typeof difficulty === 'string') {
        return difficulty.toLowerCase();
    }
    return DIFFICULTY.MEDIUM;
};

async function getTokenRewardsConfig() {
    const now = Date.now();
    if (tokenRewardsCache.data && now - tokenRewardsCache.fetchedAt < TOKEN_CONFIG_CACHE_MS) {
        return tokenRewardsCache.data;
    }

    try {
        const db = getFirestore();
        const doc = await db.collection('config').doc('tokenRewards').get();
        if (doc.exists) {
            tokenRewardsCache.data = doc.data();
            tokenRewardsCache.fetchedAt = now;
            return tokenRewardsCache.data;
        }
    } catch (error) {
        console.error('Failed to load token rewards config:', error);
    }

    tokenRewardsCache.data = null;
    tokenRewardsCache.fetchedAt = now;
    return null;
}

async function getTokenRewardsForDifficulty(difficulty) {
    const normalizedDifficulty = normalizeDifficulty(difficulty) || DIFFICULTY.MEDIUM;
    const config = await getTokenRewardsConfig();
    const configForDifficulty = config?.[normalizedDifficulty];
    const fallback = DEFAULT_REWARD_BY_DIFFICULTY[normalizedDifficulty] || {
        tokenPerCorrect: DEFAULT_TOKEN_PER_CORRECT,
        tokenPerWin: DEFAULT_TOKEN_PER_WIN
    };

    return {
        tokenPerCorrectAnswer: resolveTokenValue(
            configForDifficulty?.tokenPerCorrect ?? fallback.tokenPerCorrect,
            DEFAULT_TOKEN_PER_CORRECT
        ),
        tokenPerWin: resolveTokenValue(
            configForDifficulty?.tokenPerWin ?? fallback.tokenPerWin,
            DEFAULT_TOKEN_PER_WIN
        )
    };
}

// POST /api/game/:roomId/start - Start the game
router.post('/:roomId/start', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { playerId } = req.body;

        const rtdb = getRealtimeDb();
        const roomRef = rtdb.ref(`rooms/${roomId}`);
        const snapshot = await roomRef.get();

        if (!snapshot.exists()) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const room = snapshot.val();

        // Only host can start
        if (room.hostId !== playerId) {
            return res.status(403).json({ error: 'Only host can start the game' });
        }

        // Check all players are ready
        const players = room.players || {};
        const playerIds = Object.keys(players);

        if (playerIds.length < 2) {
            return res.status(400).json({ error: 'Need at least 2 players to start' });
        }

        const allReady = playerIds.every(id => players[id].ready);
        if (!allReady) {
            return res.status(400).json({ error: 'All players must be ready' });
        }

        // Update room status
        await roomRef.update({
            status: 'starting',
            questionNumber: 0,
            totalQuestions: room.settings.questionsCount || 10
        });

        // Start the game after a short delay
        setTimeout(() => startGameLoop(roomId, room.settings), 3000);

        res.json({ success: true });

    } catch (error) {
        console.error('Start game error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function startGameLoop(roomId, settings) {
    const rtdb = getRealtimeDb();
    const roomRef = rtdb.ref(`rooms/${roomId}`);

    // Reset per-game state
    await roomRef.update({
        status: 'playing',
        winner: null,
        winnerUsername: null,
        isDraw: false
    });

    // Reset player scores and per-game token tracking
    const playersSnap = await roomRef.child('players').get();
    if (playersSnap.exists()) {
        const resetUpdates = {};
        playersSnap.forEach((child) => {
            resetUpdates[`${child.key}/score`] = 0;
            resetUpdates[`${child.key}/tokensEarned`] = 0;
        });
        if (Object.keys(resetUpdates).length > 0) {
            await roomRef.child('players').update(resetUpdates);
        }
    }

    const baseSettings = {
        delaySeconds: Number(settings?.delaySeconds) || 5,
        roundSeconds: Number(settings?.roundSeconds) || 10,
        questionsCount: Number(settings?.questionsCount) || 10,
        questionDifficulty: settings?.questionDifficulty || DIFFICULTY.MEDIUM
    };
    const rewardSettings = await getTokenRewardsForDifficulty(baseSettings.questionDifficulty);
    const resolvedSettings = {
        ...baseSettings,
        tokenPerCorrectAnswer: rewardSettings.tokenPerCorrectAnswer,
        tokenPerWin: rewardSettings.tokenPerWin
    };

    const totalQuestions = resolvedSettings.questionsCount;
    let currentQuestion = 0;

    const askNextQuestion = async () => {
        currentQuestion++;

        if (currentQuestion > totalQuestions) {
            // Game over
            await endGame(roomId);
            return;
        }

        // Generate a new question
        const question = generateQuestion(resolvedSettings.questionDifficulty);

        await roomRef.update({
            questionNumber: currentQuestion,
            currentQuestion: {
                question: question.question,
                options: question.options,
                correctIndex: question.correctIndex,
                startedAt: Date.now(),
                answeredBy: null,
                answeredCorrectly: null,
                answerRevealed: false,
                roundSeconds: resolvedSettings.roundSeconds
            },
            settings: resolvedSettings
        });

        // Set timeout for question (roundSeconds)
        const questionTimeout = setTimeout(async () => {
            console.log(`[TIMEOUT] Timer fired for Room ${roomId}, Question ${currentQuestion}`);
            // Time's up for this question
            const snapshot = await roomRef.child('currentQuestion').get();
            if (snapshot.exists()) {
                const q = snapshot.val();
                if (!q.answeredBy) {
                    // No one answered, reveal correct answer
                    console.log(`[TIMEOUT] No answer received. Moving to next.`);
                    await roomRef.child('currentQuestion').update({
                        answerRevealed: true,
                        timeUp: true
                    });

                    // Move to next question
                    setTimeout(() => {
                        console.log(`[TIMEOUT] Next question triggering.`);
                        askNextQuestion();
                    }, resolvedSettings.delaySeconds * 1000);
                } else {
                    console.log(`[TIMEOUT] Question was answered. ignoring.`);
                }
            }
        }, resolvedSettings.roundSeconds * 1000);

        gameIntervals.set(`${roomId}-timeout`, questionTimeout);
    };

    // Start first question
    await askNextQuestion();

    // Store reference to askNextQuestion for answer handling
    gameIntervals.set(`${roomId}-nextQuestion`, askNextQuestion);

    // Attach Active Presence Monitor
    const presenceRef = rtdb.ref(`rooms/${roomId}/presence`);
    const onPresenceRemove = presenceRef.on('child_removed', (snapshot) => {
        const playerId = snapshot.key;
        console.log(`[PRESENCE] Player ${playerId} disconnected from Room ${roomId}`);
        // Trigger check immediately, explicitly excluding this player to handle race condition
        checkRoundCompletion(roomId, playerId);
    });

    // Store listener to detach later
    gameIntervals.set(`${roomId}-presenceListener`, onPresenceRemove);
}

// POST /api/game/:roomId/answer - Submit an answer
router.post('/:roomId/answer', async (req, res) => {
    //console.log(`[BACKEND] Received answer request for Room ${req.params.roomId}`);
    try {
        const { roomId } = req.params;
        const { playerId, playerUsername, answerIndex } = req.body;

        const rtdb = getRealtimeDb();
        const db = getFirestore();
        const roomRef = rtdb.ref(`rooms/${roomId}`);
        const snapshot = await roomRef.get();

        if (!snapshot.exists()) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const room = snapshot.val();

        if (room.status !== 'playing') {
            return res.status(400).json({ error: 'Game not in progress' });
        }

        const currentQuestion = room.currentQuestion;
        const playerInfo = room.players?.[playerId] || {};
        const playerLabel = playerInfo.displayName || playerInfo.username || playerUsername;

        if (!currentQuestion || currentQuestion.correctlyAnsweredBy) {
            return res.status(400).json({ error: 'Question already answered' });
        }

        // Check if player has already answered incorrectly
        if (currentQuestion.incorrectAnswers && currentQuestion.incorrectAnswers[playerId]) {
            return res.status(400).json({ error: 'You already answered this question incorrectly' });
        }

        const isCorrect = answerIndex === currentQuestion.correctIndex;
        let tokenReward = 0;

        if (isCorrect) {
            // Update who answered correctly
            await roomRef.child('currentQuestion').update({
                correctlyAnsweredBy: playerId,
                answeredBy: playerId, // Fix: Set this so TimeOut doesn't think it's missed
                answeredByUsername: playerLabel,
                answeredCorrectly: true,
                answerRevealed: true
            });

            // Update score
            const playerRef = roomRef.child(`players/${playerId}`);
            const playerSnap = await playerRef.get();
            const playerData = playerSnap.val() || {};
            const currentScore = Number(playerData.score || 0);
            const currentTokensEarned = Number(playerData.tokensEarned || 0);
            const playerUpdates = { score: currentScore + 1 };

            // Track tokens for correct answer in RTDB only (will be awarded at game end)
            const roomSettings = room.settings || {};
            const perCorrect = resolveTokenValue(roomSettings.tokenPerCorrectAnswer, DEFAULT_TOKEN_PER_CORRECT);
            if (perCorrect > 0) {
                tokenReward = perCorrect;
                playerUpdates.tokensEarned = currentTokensEarned + perCorrect;
            }
            await playerRef.update(playerUpdates);

            // Clear timeout and schedule next
            clearRoomTimeout(roomId); // Use the helper function

            const delayMs = (Number(roomSettings.delaySeconds) || 5) * 1000;
            const askNextQuestion = gameIntervals.get(`${roomId}-nextQuestion`);
            if (askNextQuestion) {
                setTimeout(() => askNextQuestion(), delayMs);
            }
        } else {
            // Mark that this player answered incorrectly
            await roomRef.child(`currentQuestion/incorrectAnswers/${playerId}`).set(true);

            // Trigger round completion check
            await checkRoundCompletion(roomId);
        }

        res.json({
            correct: isCorrect,
            correctIndex: currentQuestion.correctIndex,
            tokenReward
        });

    } catch (error) {
        console.error('Answer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Checks if the round should end based on active players and answers.
 * Can be called by:
 * 1. Submit Answer (active player answered)
 * 2. Player Disconnect (active player count dropped)
 */
async function checkRoundCompletion(roomId, removedPlayerId = null) {
    const rtdb = getRealtimeDb();
    const roomRef = rtdb.ref(`rooms/${roomId}`);
    const roomSnapshot = await roomRef.get();
    if (!roomSnapshot.exists()) return;

    const room = roomSnapshot.val();
    if (room.status !== 'playing') return;

    const currentQuestion = room.currentQuestion;
    if (currentQuestion?.answerRevealed) return; // Already ended

    const players = room.players || {};
    const presence = room.presence || {};

    let activePlayerCount = 0;
    let activeIncorrectCount = 0;
    let activeAnsweredCount = 0;

    // Calculate counts based on ACTIVE (Present) players
    Object.entries(players).forEach(([pid, p]) => {
        const isPresent = presence[pid] === true;
        const isRemoved = pid === removedPlayerId;

        // Must be present AND not the one currently being removed
        if (isPresent && !isRemoved) {
            activePlayerCount++;

            const isIncorrect = (currentQuestion.incorrectAnswers && currentQuestion.incorrectAnswers[pid]);
            const isCorrect = currentQuestion.correctlyAnsweredBy === pid;

            if (isIncorrect) activeIncorrectCount++;
            if (isIncorrect || isCorrect) activeAnsweredCount++;
        }
    });

    // Logic 1: If everyone active has answered incorrectly -> Round Over 
    if (activePlayerCount > 0 && activeIncorrectCount >= activePlayerCount) {

        try {
            await roomRef.child('currentQuestion').update({
                answerRevealed: true,
                timeUp: true
            });
        } catch (err) {
            console.error(`DB Update FAILED:`, err);
        }

        clearRoomTimeout(roomId);
        scheduleNextQuestion(roomId, room);
        return;
    }

    // Logic 3: If NO active players left?
    if (activePlayerCount === 0) {
        console.log(`[CHECK] Room ${roomId}: No active players remaining. Aborting game.`);
        await endGame(roomId, true); // Abort the game
        return;
    }
}

function scheduleNextQuestion(roomId, room) {
    const settings = room.settings || {};
    const askNextQuestion = gameIntervals.get(`${roomId}-nextQuestion`);
    if (askNextQuestion) {
        setTimeout(() => askNextQuestion(), (settings.delaySeconds || 5) * 1000);
    }
}

function clearRoomTimeout(roomId) {
    const timeout = gameIntervals.get(`${roomId}-timeout`);
    if (timeout) {
        clearTimeout(timeout);
        gameIntervals.delete(`${roomId}-timeout`);
    }
}

// Helper to clear timeouts
function clearGameIntervals(roomId) {
    const timeout = gameIntervals.get(`${roomId}-timeout`);
    if (timeout) {
        clearTimeout(timeout);
        gameIntervals.delete(`${roomId}-timeout`);
    }

    // Detach presence listener
    const presenceListener = gameIntervals.get(`${roomId}-presenceListener`);
    if (presenceListener) {
        const rtdb = getRealtimeDb();
        rtdb.ref(`rooms/${roomId}/presence`).off('child_removed', presenceListener);
        gameIntervals.delete(`${roomId}-presenceListener`);
    }

    gameIntervals.delete(`${roomId}-nextQuestion`);
}

// POST /api/game/:roomId/quit - Quit/Surrender the game
router.post('/:roomId/quit', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { playerId } = req.body;

        if (!playerId) {
            return res.status(400).json({ error: 'Missing playerId' });
        }

        const rtdb = getRealtimeDb();
        const roomRef = rtdb.ref(`rooms/${roomId}`);
        const snapshot = await roomRef.get();

        if (!snapshot.exists()) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const room = snapshot.val();
        const players = room.players || {};
        const playerData = players[playerId];

        if (!playerData) {
            return res.status(404).json({ error: 'Player not found in this room' });
        }

        const remainingPlayerIds = Object.keys(players).filter(id => id !== playerId);
        const isActiveGame = room.status === 'playing' || room.status === 'starting';

        // Remove the player so others can continue.
        await roomRef.child(`players/${playerId}`).remove();


        let roomClosed = false;
        const updates = {};

        if (remainingPlayerIds.length === 0) {
            updates.status = 'aborted';
            updates.abortedBy = playerId;
            updates.currentQuestion = null;
            roomClosed = true;
        } else {
            // Reassign host if needed
            if (room.hostId === playerId) {
                updates.hostId = remainingPlayerIds[0];
            }

            // CHECK: Should we end the current round immediately?
            // If the game is playing, and the current question is active and not yet answered correctly.
            const currentQuestion = room.currentQuestion;
            if (room.status === 'playing' && currentQuestion && !currentQuestion.correctlyAnsweredBy && !currentQuestion.timeUp) {
                // Trigger round completion check
                await checkRoundCompletion(roomId);
            }
        }

        if (Object.keys(updates).length > 0) {
            await roomRef.update(updates);
        }

        if (roomClosed) {
            clearGameIntervals(roomId); // Clears all intervals including presence listener
            await roomRef.remove();


        }

        res.json({ success: true, playerRemoved: true, roomClosed });

    } catch (error) {
        console.error('Quit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function endGame(roomId, aborted = false) {
    const rtdb = getRealtimeDb();
    const db = getFirestore();
    const roomRef = rtdb.ref(`rooms/${roomId}`);
    const snapshot = await roomRef.get();

    if (!snapshot.exists()) return;

    const room = snapshot.val();
    if (room.status === 'aborted') return; // Already aborted

    const players = room.players || {};
    const roomSettings = room.settings || {};

    // Find winner(s)
    let maxScore = 0;
    let winners = [];

    Object.entries(players).forEach(([id, player]) => {
        const playerScore = Number(player.score || 0);
        if (playerScore > maxScore) {
            maxScore = playerScore;
            winners = [{ id, label: player.displayName || player.username }];
        } else if (playerScore === maxScore && playerScore > 0) {
            winners.push({ id, label: player.displayName || player.username });
        }
    });

    const singleWinner = !aborted && maxScore > 0 && winners.length === 1 ? winners[0] : null;
    const isDraw = !aborted && maxScore > 0 && winners.length > 1;

    // Update room status
    await roomRef.update({
        status: aborted ? 'aborted' : 'ended',
        winner: singleWinner ? singleWinner.id : null,
        winnerUsername: singleWinner ? singleWinner.label : null,
        isDraw,
        currentQuestion: null
    });

    // Award accumulated tokens to ALL players at game end (not aborted)
    if (!aborted) {
        const winnerBonus = resolveTokenValue(roomSettings.tokenPerWin, DEFAULT_TOKEN_PER_WIN);

        for (const [playerId, playerData] of Object.entries(players)) {
            const playerLabel = playerData.displayName || playerData.username;
            let totalEarned = Number(playerData.tokensEarned || 0);

            // Add winner bonus if this player is the single winner
            const isWinner = singleWinner && singleWinner.id === playerId;
            if (isWinner && winnerBonus > 0) {
                totalEarned += winnerBonus;
            }

            // Award all tokens at once if any were earned
            if (totalEarned > 0) {
                const reason = isWinner
                    ? `Game Complete (+${winnerBonus} Winner Bonus)`
                    : 'Game Complete';
                await awardTokens(db, playerId, playerLabel, totalEarned, reason, roomId);
            }
        }
    }

    // Clean up intervals
    clearGameIntervals(roomId);
}

export default router;
