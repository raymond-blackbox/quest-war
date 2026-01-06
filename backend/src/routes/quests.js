import express from 'express';
import questController from '../controllers/quest.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { z } from 'zod';
import { validate } from '../middlewares/validation.middleware.js';

const router = express.Router();

const questParamsSchema = z.object({
    params: z.object({
        playerId: z.string().min(1),
    }),
});

const claimQuestSchema = z.object({
    params: z.object({
        playerId: z.string().min(1),
        questId: z.string().min(1),
    }),
});

/**
 * GET /api/quests/:playerId
 * Get all quests for a player
 */
router.get('/:playerId', authMiddleware, validate(questParamsSchema), questController.getPlayerQuests);

/**
 * POST /api/quests/:playerId/claim/:questId
 * Claim quest reward
 */
router.post('/:playerId/claim/:questId', authMiddleware, validate(claimQuestSchema), questController.claimQuestReward);

export default router;
