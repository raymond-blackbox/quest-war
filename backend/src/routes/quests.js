import express from 'express';
import questController from '../controllers/quest.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { z } from 'zod';
import { validate } from '../middlewares/validation.middleware.js';

const router = express.Router();

const safeId = z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/);

const questParamsSchema = z.object({
    params: z.object({
        playerId: safeId,
    }),
});

const claimQuestSchema = z.object({
    params: z.object({
        playerId: safeId,
        questId: safeId,
    }),
});

/**
 * @swagger
 * /api/quests/{playerId}:
 *   get:
 *     summary: Get all quests for a player
 *     tags: [Quests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of player quests and progress.
 */
router.get('/:playerId', authMiddleware, validate(questParamsSchema), questController.getPlayerQuests);

/**
 * @swagger
 * /api/quests/{playerId}/claim/{questId}:
 *   post:
 *     summary: Claim quest reward
 *     tags: [Quests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: questId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reward claimed.
 */
router.post('/:playerId/claim/:questId', authMiddleware, validate(claimQuestSchema), questController.claimQuestReward);

export default router;
