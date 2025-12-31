import { getFirestore, admin } from './firebase.js';
import logger from './logger.js';

/**
 * Updates user statistics in Firestore players collection.
 * 
 * @param {string} playerId - The ID of the player to update stats for.
 * @param {string} gameType - The type of game (e.g., 'math', 'science').
 * @param {string} difficulty - The difficulty level (e.g., 'easy', 'medium', 'hard').
 * @param {number} answeredCount - Number of questions answered.
 * @param {number} correctCount - Number of questions answered correctly.
 */
export async function updateUserStats(playerId, gameType, difficulty, answeredCount, correctCount, options = {}) {
    if (!playerId || answeredCount <= 0) return;

    try {
        const db = getFirestore();
        const playerRef = db.collection('players').doc(playerId);

        // Normalize values to lowercase for consistency
        const type = gameType.toLowerCase();
        const diff = difficulty.toLowerCase();

        const updates = {};
        // Per game-type and difficulty stats
        updates[`stats.${type}.${diff}.totalAnswered`] = admin.firestore.FieldValue.increment(answeredCount);
        updates[`stats.${type}.${diff}.totalCorrect`] = admin.firestore.FieldValue.increment(correctCount);

        // Global totals for profile and leaderboard
        updates.totalAnswered = admin.firestore.FieldValue.increment(answeredCount);
        updates.totalCorrect = admin.firestore.FieldValue.increment(correctCount);

        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        await playerRef.update(updates);

        // Sync to leaderboard if requested (usually for competitive multiplayer)
        if (options.updateLeaderboard !== false) {
            const leaderboardRef = db.collection('leaderboard').doc(playerId);
            const leaderboardUpdates = {
                // Global totals
                totalAnswered: admin.firestore.FieldValue.increment(answeredCount),
                totalCorrect: admin.firestore.FieldValue.increment(correctCount),
                // Granular stats (nested object structure for set with merge)
                stats: {
                    [type]: {
                        [diff]: {
                            totalAnswered: admin.firestore.FieldValue.increment(answeredCount),
                            totalCorrect: admin.firestore.FieldValue.increment(correctCount)
                        }
                    }
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            await leaderboardRef.set(leaderboardUpdates, { merge: true });
        }

        logger.debug(`[STATS] Updated stats for player ${playerId}: ${type}/${diff} (+${answeredCount} ans, +${correctCount} corr)`);
    } catch (error) {
        logger.error(`[STATS] Error updating user stats for ${playerId}:`, error);
    }
}
