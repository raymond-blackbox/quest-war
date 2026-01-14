import { getRealtimeDb, getFirestore } from './firebase.js';
import { getQuestionProvider, GAME_TYPES } from './questionProviders/index.js';
import { updateMultipleQuestProgress } from './quests.js';
import { updateUserStats } from './userStats.js';
import leaderboardService from './leaderboard.service.js';
import { transactionService, TRANSACTION_TYPES } from './transaction.service.js';

import logger from './logger.js';

// Get the default math provider and its exports
const mathProvider = getQuestionProvider(GAME_TYPES.MATH);
const { DIFFICULTY } = mathProvider;

// Store active game intervals
const gameIntervals = new Map();
const questCounters = new Map();

const DEFAULT_TOKEN_PER_CORRECT = 1;
const DEFAULT_TOKEN_PER_WIN = 1;
const SOLO_TOKEN_PER_CORRECT = 1;
const SOLO_TOKEN_PER_WIN = 0;
const TOKEN_CONFIG_CACHE_MS = 60 * 1000;

const DEFAULT_REWARD_BY_DIFFICULTY = {
    [DIFFICULTY.EASY]: { tokenPerCorrect: 1, tokenPerWin: 10 },
    [DIFFICULTY.MEDIUM]: { tokenPerCorrect: 2, tokenPerWin: 20 },
    [DIFFICULTY.HARD]: { tokenPerCorrect: 3, tokenPerWin: 30 }
};

const GAME_SESSION_COLLECTION = 'gameSessions';

const tokenRewardsCache = {
    data: null,
    fetchedAt: 0
};

// --- Helper Functions ---

function getRoomQuestCounters(roomId) {
    if (!questCounters.has(roomId)) {
        questCounters.set(roomId, new Map());
    }
    return questCounters.get(roomId);
}

function incrementQuestCounter(roomId, playerId, field) {
    const roomCounters = getRoomQuestCounters(roomId);
    const playerCounters = roomCounters.get(playerId) || {
        dailyCorrect: 0,
        speedCorrect: 0,
        totalAnswered: 0,
        totalCorrect: 0
    };
    playerCounters[field] += 1;
    roomCounters.set(playerId, playerCounters);
}

const resolveTokenValue = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }
    return Math.round(parsed);
};

const normalizeDifficulty = (difficulty) => {
    if (typeof difficulty === 'string') {
        return difficulty.toLowerCase();
    }
    return DIFFICULTY.MEDIUM;
};

async function updateMultipleQuestProgressSafe(playerId, updates) {
    try {
        await updateMultipleQuestProgress(playerId, updates);
    } catch (error) {
        logger.error('Quest progress update error:', error);
    }
}

// --- Service Implementation ---

export const gameService = {
    async getTokenRewardsConfig() {
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
            logger.error('Failed to load token rewards config:', error);
        }

        tokenRewardsCache.data = null;
        tokenRewardsCache.fetchedAt = now;
        return null;
    },

    async getTokenRewardsForDifficulty(difficulty) {
        const normalizedDifficulty = normalizeDifficulty(difficulty) || DIFFICULTY.MEDIUM;
        const config = await this.getTokenRewardsConfig();
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
    },

    async awardTokens(db, playerId, playerLabel, tokenDelta, reason = 'Quest Reward', roomId = null, options = {}) {
        if (!playerId || tokenDelta <= 0) return;

        const { updateLeaderboard = true } = options;
        const playerDocRef = db.collection('players').doc(playerId);
        const playerDoc = await playerDocRef.get();

        if (!playerDoc.exists) return;

        const currentTokens = Number(playerDoc.data().tokens || 0);
        const newTokens = currentTokens + tokenDelta;
        await playerDocRef.update({ tokens: newTokens });

        const resolvedDisplayName = playerLabel || playerDoc.data().displayName || playerDoc.data().username;
        const resolvedUsername = playerDoc.data().username;

        if (updateLeaderboard) {
            await leaderboardService.syncPlayer(playerId, {
                username: resolvedUsername,
                displayName: resolvedDisplayName,
                tokens: newTokens,
                totalTokensEarned: tokenDelta // LeaderboardService uses increment
            });
        }

        // Log the transaction
        await transactionService.logTransaction(db, {
            playerId,
            type: TRANSACTION_TYPES.EARN,
            amount: tokenDelta,
            reason,
            roomId
        });

    },

    async persistGameSession(db, summary) {
        try {
            await db.collection(GAME_SESSION_COLLECTION).doc(summary.sessionId).set(summary);
        } catch (error) {
            logger.error('Game session save error:', error);
        }
    },

    buildGameSessionSummary({ sessionId, roomId, room, aborted, singleWinner, isDraw, winnerBonus }) {
        const players = room.players || {};
        const roomSettings = room.settings || {};
        const playersSummary = Object.entries(players).map(([playerId, playerData]) => {
            const score = Number(playerData.score || 0);
            const tokensEarned = Number(playerData.tokensEarned || 0);
            const isWinner = !!singleWinner && singleWinner.id === playerId;
            const winnerBonusEarned = !aborted && isWinner ? winnerBonus : 0;
            return {
                playerId,
                username: playerData.username || null,
                displayName: playerData.displayName || playerData.username || null,
                score,
                tokensEarned,
                winnerBonus: winnerBonusEarned,
                totalTokensEarned: aborted ? 0 : tokensEarned + winnerBonusEarned,
                isWinner
            };
        });

        return {
            sessionId,
            roomId,
            roomName: room.name || null,
            hostId: room.hostId || null,
            status: aborted ? 'aborted' : 'ended',
            isDraw: !!isDraw,
            winnerId: singleWinner?.id || null,
            winnerName: singleWinner?.label || null,
            playerCount: playersSummary.length,
            settingsSnapshot: roomSettings,
            tokensAwarded: !aborted,
            players: playersSummary,
            endedAt: new Date()
        };
    },

    async startGameLoop(roomId, settings, options = {}) {
        const isSolo = options.isSolo === true;
        const rtdb = getRealtimeDb();
        const roomRef = rtdb.ref(`rooms/${roomId}`);
        questCounters.set(roomId, new Map());

        // Get the question provider based on game type (defaults to math)
        const gameType = settings?.gameType || GAME_TYPES.MATH;
        const questionProvider = getQuestionProvider(gameType);

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
            gameType: settings?.gameType || GAME_TYPES.MATH,
            delaySeconds: Number(settings?.delaySeconds) || 2,
            roundSeconds: Number(settings?.roundSeconds) || 10,
            questionsCount: Number(settings?.questionsCount) || 10,
            questionDifficulty: settings?.questionDifficulty || DIFFICULTY.MEDIUM
        };
        const rewardSettings = isSolo
            ? { tokenPerCorrectAnswer: SOLO_TOKEN_PER_CORRECT, tokenPerWin: SOLO_TOKEN_PER_WIN }
            : await this.getTokenRewardsForDifficulty(baseSettings.questionDifficulty);
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
                await this.endGame(roomId);
                return;
            }

            // Generate a new question using the provider (await for async providers like science)
            const question = await questionProvider.generateQuestion(resolvedSettings.questionDifficulty);

            await roomRef.update({
                questionNumber: currentQuestion,
                currentQuestion: {
                    question: question.question,
                    options: question.options,
                    correctIndex: question.correctIndex,
                    startedAt: Date.now(),
                    answeredBy: null,
                    correctlyAnsweredBy: null,
                    answeredCorrectly: null,
                    answerRevealed: false,
                    roundSeconds: resolvedSettings.roundSeconds
                },
                settings: resolvedSettings
            });

            // Set timeout for question (roundSeconds)
            this.clearRoomTimeout(roomId); // Clear any existing timeout before setting a new one
            const questionTimeout = setTimeout(async () => {
                const snapshot = await roomRef.child('currentQuestion').get();
                if (snapshot.exists()) {
                    const q = snapshot.val();
                    if (!q.correctlyAnsweredBy) {
                        await roomRef.child('currentQuestion').update({
                            answerRevealed: true,
                            timeUp: true
                        });
                        this.scheduleNextQuestion(roomId, { settings: resolvedSettings });
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
            logger.info(`[PRESENCE] Player ${playerId} disconnected from Room ${roomId}`);
            this.checkRoundCompletion(roomId, playerId);
        });

        // Store listener to detach later
        gameIntervals.set(`${roomId}-presenceListener`, onPresenceRemove);
    },

    async checkRoundCompletion(roomId, removedPlayerId = null) {
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

        // Calculate counts based on ACTIVE (Present) players
        Object.entries(players).forEach(([pid, p]) => {
            const isPresent = presence[pid] === true;
            const isRemoved = pid === removedPlayerId;

            // Must be present AND not the one currently being removed
            if (isPresent && !isRemoved) {
                activePlayerCount++;

                const isIncorrect = (currentQuestion.incorrectAnswers && currentQuestion.incorrectAnswers[pid]);
                if (isIncorrect) activeIncorrectCount++;
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
                logger.error(`DB Update FAILED:`, err);
            }

            this.clearRoomTimeout(roomId);
            this.scheduleNextQuestion(roomId, room);
            return;
        }

        // Logic 3: If NO active players left?
        if (activePlayerCount === 0) {
            logger.info(`[CHECK] Room ${roomId}: No active players remaining. Aborting game.`);
            await this.endGame(roomId, true); // Abort the game
            return;
        }
    },

    scheduleNextQuestion(roomId, room) {
        const roomSettings = room.settings || {};
        const askNextQuestion = gameIntervals.get(`${roomId}-nextQuestion`);
        if (askNextQuestion) {
            this.clearRoomTimeout(roomId);
            const timeout = setTimeout(() => askNextQuestion(), (roomSettings.delaySeconds || 5) * 1000);
            gameIntervals.set(`${roomId}-timeout`, timeout);
        }
    },

    clearRoomTimeout(roomId) {
        const timeout = gameIntervals.get(`${roomId}-timeout`);
        if (timeout) {
            clearTimeout(timeout);
            gameIntervals.delete(`${roomId}-timeout`);
        }
    },

    clearGameIntervals(roomId) {
        this.clearRoomTimeout(roomId);

        // Detach presence listener
        const presenceListener = gameIntervals.get(`${roomId}-presenceListener`);
        if (presenceListener) {
            const rtdb = getRealtimeDb();
            rtdb.ref(`rooms/${roomId}/presence`).off('child_removed', presenceListener);
            gameIntervals.delete(`${roomId}-presenceListener`);
        }

        gameIntervals.delete(`${roomId}-nextQuestion`);
        questCounters.delete(roomId);
    },

    async endGame(roomId, aborted = false) {
        const rtdb = getRealtimeDb();
        const db = getFirestore();
        const roomRef = rtdb.ref(`rooms/${roomId}`);
        const snapshot = await roomRef.get();

        if (!snapshot.exists()) return;

        const room = snapshot.val();
        const isSolo = room.isSolo === true;
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
        const winnerBonus = isSolo ? SOLO_TOKEN_PER_WIN : resolveTokenValue(roomSettings.tokenPerWin, DEFAULT_TOKEN_PER_WIN);

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
                    const reason = isWinner && winnerBonus > 0
                        ? `Game Complete (+${winnerBonus} Winner Bonus)`
                        : 'Game Complete';
                    await this.awardTokens(db, playerId, playerLabel, totalEarned, reason, roomId, {
                        updateLeaderboard: !isSolo
                    });
                }

                // Update user stats in Firestore (Multiplayer only)
                const roomCounters = getRoomQuestCounters(roomId);
                const playerCounters = roomCounters.get(playerId);
                if (!isSolo && playerCounters && playerCounters.totalAnswered > 0) {
                    await updateUserStats(
                        playerId,
                        roomSettings.gameType || GAME_TYPES.MATH,
                        roomSettings.questionDifficulty || DIFFICULTY.MEDIUM,
                        playerCounters.totalAnswered,
                        playerCounters.totalCorrect,
                        { updateLeaderboard: !isSolo }
                    );
                }

                // Update quest progress for game completion
                if (!isSolo) {
                    const roomCounters = getRoomQuestCounters(roomId);
                    const playerScore = Number(playerData.score || 0);
                    const totalQuestions = roomSettings.questionsCount || 10;
                    const accuracy = totalQuestions > 0 ? (playerScore / totalQuestions) * 100 : 0;
                    const gameData = {
                        won: isWinner,
                        difficulty: roomSettings.questionDifficulty,
                        playerCount: Object.keys(players).length,
                        accuracy,
                        questionsCount: totalQuestions
                    };

                    const counters = roomCounters.get(playerId) || { dailyCorrect: 0, speedCorrect: 0 };
                    const questUpdates = [];

                    if (counters.dailyCorrect > 0) {
                        questUpdates.push({
                            questId: 'daily_math_warrior',
                            increment: counters.dailyCorrect
                        });
                    }

                    if (counters.speedCorrect > 0) {
                        questUpdates.push({
                            questId: 'speed_demon',
                            increment: counters.speedCorrect,
                            gameData: { fastCorrect: true }
                        });
                    }

                    questUpdates.push(
                        { questId: 'streak_master', increment: 1, gameData },
                        { questId: 'social_butterfly', increment: 1, gameData },
                        { questId: 'mastery_seeker', increment: counters.dailyCorrect || 0, gameData },
                        { questId: 'collector_explorer', increment: 1, gameData },
                        { questId: 'weekly_champion', increment: 1, gameData },
                        { questId: 'perfectionist', increment: 1, gameData }
                    );

                    await updateMultipleQuestProgressSafe(playerId, questUpdates);
                }
            }
        }

        const sessionId = db.collection(GAME_SESSION_COLLECTION).doc().id;
        const sessionSummary = this.buildGameSessionSummary({
            sessionId,
            roomId,
            room,
            aborted,
            singleWinner,
            isDraw,
            winnerBonus
        });
        await this.persistGameSession(db, sessionSummary);

        // Clean up intervals
        this.clearGameIntervals(roomId);
    },

    // --- Orchestration Methods (called by Routes) ---

    async startGame(roomId, playerId) {
        const rtdb = getRealtimeDb();
        const roomRef = rtdb.ref(`rooms/${roomId}`);
        const snapshot = await roomRef.get();

        if (!snapshot.exists()) {
            throw new Error('Room not found');
        }

        const room = snapshot.val();
        const isSolo = room.isSolo === true;

        if (room.hostId !== playerId) {
            throw new Error('Only host can start the game');
        }

        const players = room.players || {};
        const playerIds = Object.keys(players);

        if (isSolo && playerIds.length !== 1) {
            throw new Error('Solo rooms can only have 1 player');
        }

        if (!isSolo && playerIds.length < 2) {
            throw new Error('Need at least 2 players to start');
        }

        if (!isSolo) {
            const allReady = playerIds.every(id => players[id].ready);
            if (!allReady) {
                throw new Error('All players must be ready');
            }
        }

        await roomRef.update({
            status: 'starting',
            questionNumber: 0,
            totalQuestions: room.settings.questionsCount || 10
        });

        setTimeout(() => this.startGameLoop(roomId, room.settings, { isSolo }), 3000);
    },

    async resetGame(roomId, playerId) {
        const rtdb = getRealtimeDb();
        const roomRef = rtdb.ref(`rooms/${roomId}`);
        const snapshot = await roomRef.get();

        if (!snapshot.exists()) {
            throw new Error('Room not found');
        }

        const room = snapshot.val();
        const isSolo = room.isSolo === true;

        if (room.hostId !== playerId) {
            throw new Error('Only host can reset the game');
        }

        if (room.status !== 'ended' && room.status !== 'aborted') {
            throw new Error('Game must be ended before reset');
        }

        this.clearGameIntervals(roomId);

        const resetUpdates = {
            status: 'waiting',
            questionNumber: 0,
            totalQuestions: null,
            currentQuestion: null,
            winner: null,
            winnerUsername: null,
            isDraw: false,
            abortedBy: null,
            currentGameId: rtdb.ref().push().key,
            lastResetAt: Date.now()
        };

        const players = room.players || {};
        Object.keys(players).forEach((pid) => {
            resetUpdates[`players/${pid}/ready`] = isSolo && pid === room.hostId;
            resetUpdates[`players/${pid}/score`] = 0;
            resetUpdates[`players/${pid}/tokensEarned`] = 0;
        });

        await roomRef.update(resetUpdates);
    },

    async submitAnswer(roomId, playerId, playerUsername, answerIndex) {
        const rtdb = getRealtimeDb();
        const roomRef = rtdb.ref(`rooms/${roomId}`);
        const snapshot = await roomRef.get();

        if (!snapshot.exists()) {
            throw new Error('Room not found');
        }

        const room = snapshot.val();
        const isSolo = room.isSolo === true;

        if (room.status !== 'playing') {
            throw new Error('Game not in progress');
        }

        const currentQuestion = room.currentQuestion;
        const playerInfo = room.players?.[playerId] || {};
        const playerLabel = playerInfo.displayName || playerInfo.username || playerUsername;

        if (!currentQuestion || currentQuestion.correctlyAnsweredBy) {
            throw new Error('Question already answered');
        }

        if (currentQuestion.incorrectAnswers && currentQuestion.incorrectAnswers[playerId]) {
            throw new Error('You already answered this question incorrectly');
        }

        const isCorrect = answerIndex === currentQuestion.correctIndex;
        let tokenReward = 0;

        if (isCorrect) {
            await roomRef.child('currentQuestion').update({
                correctlyAnsweredBy: playerId,
                answeredBy: playerId,
                answeredByUsername: playerLabel,
                answeredCorrectly: true,
                answerRevealed: true
            });

            const playerRef = roomRef.child(`players/${playerId}`);
            const playerSnap = await playerRef.get();
            const playerData = playerSnap.val() || {};
            const currentScore = Number(playerData.score || 0);
            const currentTokensEarned = Number(playerData.tokensEarned || 0);
            const playerUpdates = { score: currentScore + 1 };

            const roomSettings = room.settings || {};
            const perCorrect = isSolo
                ? SOLO_TOKEN_PER_CORRECT
                : resolveTokenValue(roomSettings.tokenPerCorrectAnswer, DEFAULT_TOKEN_PER_CORRECT);

            if (perCorrect > 0) {
                tokenReward = perCorrect;
                playerUpdates.tokensEarned = currentTokensEarned + perCorrect;
            }
            await playerRef.update(playerUpdates);

            if (!isSolo) {
                const answerTime = Date.now() - currentQuestion.startedAt;
                incrementQuestCounter(roomId, playerId, 'dailyCorrect');
                if (answerTime < 3000) {
                    incrementQuestCounter(roomId, playerId, 'speedCorrect');
                }
            }

            incrementQuestCounter(roomId, playerId, 'totalAnswered');
            incrementQuestCounter(roomId, playerId, 'totalCorrect');

            this.clearRoomTimeout(roomId);
            this.scheduleNextQuestion(roomId, room);
        } else {
            await roomRef.child(`currentQuestion/incorrectAnswers/${playerId}`).set(true);
            incrementQuestCounter(roomId, playerId, 'totalAnswered');
            await this.checkRoundCompletion(roomId);
        }

        return {
            correct: isCorrect,
            correctIndex: currentQuestion.correctIndex,
            tokenReward
        };
    },

    async quitGame(roomId, playerId) {
        const rtdb = getRealtimeDb();
        const roomRef = rtdb.ref(`rooms/${roomId}`);
        const snapshot = await roomRef.get();

        if (!snapshot.exists()) {
            throw new Error('Room not found');
        }

        const room = snapshot.val();
        const players = room.players || {};
        const playerData = players[playerId];

        if (!playerData) {
            throw new Error('Player not found in this room');
        }

        const remainingPlayerIds = Object.keys(players).filter(id => id !== playerId);
        await roomRef.child(`players/${playerId}`).remove();

        let roomClosed = false;
        const updates = {};

        if (remainingPlayerIds.length === 0) {
            updates.status = 'aborted';
            updates.abortedBy = playerId;
            updates.currentQuestion = null;
            roomClosed = true;
        } else {
            if (room.hostId === playerId) {
                updates.hostId = remainingPlayerIds[0];
            }

            const currentQuestion = room.currentQuestion;
            if (room.status === 'playing' && currentQuestion && !currentQuestion.correctlyAnsweredBy && !currentQuestion.timeUp) {
                await this.checkRoundCompletion(roomId);
            }
        }

        if (Object.keys(updates).length > 0) {
            await roomRef.update(updates);
        }

        if (roomClosed) {
            this.clearGameIntervals(roomId);
            await roomRef.remove();
        }

        return { success: true, playerRemoved: true, roomClosed };
    }
};
