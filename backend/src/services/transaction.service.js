import { getFirestore, admin } from './firebase.js';
import logger from './logger.js';
import { formatPaginatedResponse } from '../utils/pagination.js';

export const TRANSACTION_TYPES = {
    EARN: 'earn',
    SPEND: 'spend',
    REVOKE: 'revoke'
};

export const TRANSACTION_REASONS = {
    CORRECT_ANSWER: 'Correct Answer',
    GAME_WON: 'Game Won',
    NAME_CHANGE: 'Name Change',
    QUIT_GAME: 'Quit Game (Revoked)'
};

export const transactionService = {
    /**
     * Log a transaction to Firestore
     */
    async logTransaction(db, { playerId, type, amount, reason, roomId = null }) {
        if (!playerId || !type || !amount) return;

        try {
            const transactionsRef = db.collection('transactions');
            await transactionsRef.add({
                playerId,
                type,
                amount: Math.abs(amount),
                reason: reason || 'Unknown',
                roomId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            logger.error('Log transaction error:', error);
            throw error;
        }
    },

    /**
     * Fetch player transactions with pagination
     */
    async getPlayerTransactions(playerId, { limit = 50, offset = 0 } = {}) {
        try {
            const db = getFirestore();
            const transactionsRef = db.collection('transactions');
            const safeLimit = Math.min(limit, 100);

            // Get total count for pagination metadata
            const countSnapshot = await transactionsRef
                .where('playerId', '==', playerId)
                .count()
                .get();
            const totalCount = countSnapshot.data().count;

            // Query transactions for this player, ordered by newest first
            let query = transactionsRef
                .where('playerId', '==', playerId)
                .orderBy('createdAt', 'desc')
                .limit(safeLimit);

            // Handle pagination with offset
            if (offset > 0) {
                const skipSnapshot = await transactionsRef
                    .where('playerId', '==', playerId)
                    .orderBy('createdAt', 'desc')
                    .limit(offset)
                    .get();

                if (!skipSnapshot.empty) {
                    const lastDoc = skipSnapshot.docs[skipSnapshot.docs.length - 1];
                    query = transactionsRef
                        .where('playerId', '==', playerId)
                        .orderBy('createdAt', 'desc')
                        .startAfter(lastDoc)
                        .limit(safeLimit);
                }
            }

            const snapshot = await query.get();

            const transactions = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    type: data.type,
                    amount: data.amount,
                    reason: data.reason,
                    roomId: data.roomId || null,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || null
                };
            });

            return formatPaginatedResponse(transactions, totalCount, safeLimit, offset);
        } catch (error) {
            logger.error('Fetch transactions error:', error);
            throw error;
        }
    }
};
