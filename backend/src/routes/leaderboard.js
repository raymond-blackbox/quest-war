import express from 'express';
import { getFirestore } from '../services/firebase.js';

const router = express.Router();

// GET /api/leaderboard - Get top 100 players
router.get('/', async (req, res) => {
    try {
        const db = getFirestore();
        const leaderboardRef = db.collection('leaderboard');
        const snapshot = await leaderboardRef
            .orderBy('tokens', 'desc')
            .limit(100)
            .get();

        const leaderboard = [];
        snapshot.forEach((doc) => {
            leaderboard.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json(leaderboard);

    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
