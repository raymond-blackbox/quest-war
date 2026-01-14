import express from 'express';
import leaderboardService from '../services/leaderboard.service.js';
import logger from '../services/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/leaderboard:
 *   get:
 *     summary: Get top players
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [balance, earnings]
 *         description: Sort category
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of records to return
 *     responses:
 *       200:
 *         description: List of top players.
 */
router.get('/', async (req, res) => {
    try {
        const category = req.query.category || 'balance';
        const limit = parseInt(req.query.limit) || 100;

        const leaderboard = await leaderboardService.getLeaderboard(category, limit);
        res.json(leaderboard);

    } catch (error) {
        logger.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


export default router;

