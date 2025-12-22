import express from 'express';
import { getFirestore, admin } from '../services/firebase.js';

const router = express.Router();

const TRANSACTION_TYPES = {
    EARN: 'earn',
    SPEND: 'spend',
    REVOKE: 'revoke'
};

const TRANSACTION_REASONS = {
    CORRECT_ANSWER: 'Correct Answer',
    GAME_WON: 'Game Won',
    NAME_CHANGE: 'Name Change',
    QUIT_GAME: 'Quit Game (Revoked)'
};

/**
 * Log a transaction to Firestore
 */
async function logTransaction(db, { playerId, type, amount, reason, roomId = null }) {
    if (!playerId || !type || !amount) return;

    const transactionsRef = db.collection('transactions');
    await transactionsRef.add({
        playerId,
        type,
        amount: Math.abs(amount),
        reason: reason || 'Unknown',
        roomId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

// GET /api/transactions/:playerId - Fetch player transactions
router.get('/:playerId', async (req, res) => {
    try {
        const { playerId } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = parseInt(req.query.offset) || 0;

        const db = getFirestore();
        const transactionsRef = db.collection('transactions');

        // Query transactions for this player, ordered by newest first
        let query = transactionsRef
            .where('playerId', '==', playerId)
            .orderBy('createdAt', 'desc')
            .limit(limit);

        // Handle pagination with offset (simple approach)
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
                    .limit(limit);
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

        res.json({ transactions });

    } catch (error) {
        console.error('Fetch transactions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
export { logTransaction, TRANSACTION_TYPES, TRANSACTION_REASONS };
