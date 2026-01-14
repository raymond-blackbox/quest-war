import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { transactionService } from '../services/transaction.service.js';
import logger from '../services/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/transactions/{playerId}:
 *   get:
 *     summary: Fetch player transactions
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of transactions with pagination metadata.
 */
router.get('/:playerId', authMiddleware, async (req, res) => {
    try {
        const { playerId } = req.params;

        // Ensure user is fetching their own transactions
        if (req.user.uid !== playerId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const paginatedResult = await transactionService.getPlayerTransactions(playerId, { limit, offset });
        res.json(paginatedResult);

    } catch (error) {
        logger.error('Fetch transactions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


export default router;

