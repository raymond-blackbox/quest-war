import express from 'express';
import { getFirestore } from '../services/firebase.js';

const router = express.Router();

// GET /api/leaderboard - Get top 100 players
// Optional query param: category = 'balance' (default) | 'earnings'
router.get('/', async (req, res) => {
    try {
        const db = getFirestore();
        const leaderboardRef = db.collection('leaderboard');
        const category = req.query.category || 'balance';

        // Sort by tokens (current balance) or totalTokensEarned (lifetime quest earnings)
        const sortField = category === 'earnings' ? 'totalTokensEarned' : 'tokens';

        const snapshot = await leaderboardRef
            .orderBy(sortField, 'desc')
            .limit(100)
            .get();

        const leaderboard = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            leaderboard.push({
                id: doc.id,
                ...data,
                // Include both fields for display purposes
                displayValue: category === 'earnings'
                    ? (data.totalTokensEarned || 0)
                    : (data.tokens || 0)
            });
        });

        res.json(leaderboard);

    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
