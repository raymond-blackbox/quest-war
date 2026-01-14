import { getFirestore, admin } from './firebase.js';
import logger from './logger.js';

export class LeaderboardService {
    /**
     * Syncs a player's current state to the leaderboard.
     * @param {string} playerId 
     * @param {object} data - { tokens, totalTokensEarned, displayName, username }
     */
    async syncPlayer(playerId, data) {
        if (!playerId) return;

        try {
            const db = getFirestore();
            const leaderboardRef = db.collection('leaderboard').doc(playerId);

            const updatePayload = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (data.tokens !== undefined) updatePayload.tokens = Number(data.tokens);
            if (data.totalTokensEarned !== undefined) {
                updatePayload.totalTokensEarned = admin.firestore.FieldValue.increment(Number(data.totalTokensEarned));
            }
            if (data.displayName !== undefined) updatePayload.displayName = data.displayName;
            if (data.username !== undefined) updatePayload.username = data.username;

            await leaderboardRef.set(updatePayload, { merge: true });

            logger.debug(`[LEADERBOARD] Synced player ${playerId}`);
        } catch (error) {
            logger.error(`[LEADERBOARD] Error syncing player ${playerId}:`, error);
        }
    }

    /**
     * Optimized sync for use within a transaction.
     * @param {FirebaseFirestore.Transaction} transaction 
     * @param {string} playerId 
     * @param {object} data 
     */
    async syncPlayerWithTransaction(transaction, playerId, data) {
        if (!playerId) return;

        const db = getFirestore();
        const leaderboardRef = db.collection('leaderboard').doc(playerId);

        const updatePayload = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (data.tokens !== undefined) updatePayload.tokens = Number(data.tokens);
        if (data.totalTokensEarned !== undefined) {
            updatePayload.totalTokensEarned = admin.firestore.FieldValue.increment(Number(data.totalTokensEarned));
        }
        if (data.displayName !== undefined) updatePayload.displayName = data.displayName;
        if (data.username !== undefined) updatePayload.username = data.username;

        transaction.set(leaderboardRef, updatePayload, { merge: true });
    }

    /**

     * Fetch the top players for a specific category.
     * @param {string} category - 'balance' | 'earnings'
     * @param {number} limit 
     */
    async getLeaderboard(category = 'balance', limit = 100) {
        try {
            const db = getFirestore();
            const leaderboardRef = db.collection('leaderboard');
            const sortField = category === 'earnings' ? 'totalTokensEarned' : 'tokens';

            const snapshot = await leaderboardRef
                .orderBy(sortField, 'desc')
                .limit(Math.min(limit, 100))
                .get();

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    displayValue: category === 'earnings'
                        ? (data.totalTokensEarned || 0)
                        : (data.tokens || 0)
                };
            });
        } catch (error) {
            logger.error('[LEADERBOARD] Fetch error:', error);
            throw error;
        }
    }
}


export default new LeaderboardService();
