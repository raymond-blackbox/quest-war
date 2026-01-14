import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { startGameSchema, submitAnswerSchema } from '../validations/game.validation.js';
import { gameService } from '../services/game.service.js';
import logger from '../services/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/game/{roomId}/start:
 *   post:
 *     summary: Start the game
 *     tags: [Game]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Game started.
 */
router.post('/:roomId/start', authMiddleware, validate(startGameSchema), async (req, res) => {
    try {
        const { roomId } = req.params;
        const playerId = req.user.uid;

        await gameService.startGame(roomId, playerId);
        res.json({ success: true });

    } catch (error) {
        logger.error('Start game error:', error);
        let status = 400;
        if (error.message === 'Room not found') status = 404;
        if (error.message === 'Only host can start the game') status = 403;

        res.status(status).json({
            error: error.message || 'Internal server error'
        });
    }
});


/**
 * @swagger
 * /api/game/{roomId}/reset:
 *   post:
 *     summary: Reset game session
 *     tags: [Game]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session reset.
 */
router.post('/:roomId/reset', authMiddleware, async (req, res) => {
    try {
        const { roomId } = req.params;
        const playerId = req.user.uid;

        await gameService.resetGame(roomId, playerId);
        res.json({ success: true });

    } catch (error) {
        logger.error('Reset game error:', error);
        let status = 400;
        if (error.message === 'Room not found') status = 404;
        if (error.message === 'Only host can reset the game') status = 403;

        res.status(status).json({
            error: error.message || 'Internal server error'
        });
    }
});


/**
 * @swagger
 * /api/game/{roomId}/answer:
 *   post:
 *     summary: Submit an answer
 *     tags: [Game]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - playerUsername
 *               - answerIndex
 *             properties:
 *               playerUsername:
 *                 type: string
 *               answerIndex:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Answer processed.
 */
router.post('/:roomId/answer', authMiddleware, validate(submitAnswerSchema), async (req, res) => {
    try {
        const { roomId } = req.params;
        const { playerUsername, answerIndex } = req.body;
        const playerId = req.user.uid;

        const result = await gameService.submitAnswer(roomId, playerId, playerUsername, answerIndex);
        res.json(result);

    } catch (error) {
        logger.error('Answer error:', error);
        res.status(error.message === 'Room not found' ? 404 : 400).json({
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/game/{roomId}/quit:
 *   post:
 *     summary: Quit the game
 *     tags: [Game]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully quit.
 */
router.post('/:roomId/quit', authMiddleware, async (req, res) => {
    try {
        const { roomId } = req.params;
        const playerId = req.user.uid;

        const result = await gameService.quitGame(roomId, playerId);
        res.json(result);

    } catch (error) {
        logger.error('Quit error:', error);
        res.status(error.message === 'Room not found' ? 404 : 400).json({
            error: error.message || 'Internal server error'
        });
    }
});


export default router;

