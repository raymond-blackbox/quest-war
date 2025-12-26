import express from 'express';
import { getFirestore, admin } from '../services/firebase.js';
import { logTransaction, TRANSACTION_TYPES } from './transactions.js';
import logger from '../services/logger.js';
import {
    QUEST_DEFINITIONS,
    getQuestDefinition,
    getResetTimestamp,
    resetProgressIfNeeded
} from '../services/quests.js';

const router = express.Router();

// GET /api/quests/:playerId - Get all quests with progress for a player
router.get('/:playerId', async (req, res) => {
    try {
        const { playerId } = req.params;
        const db = getFirestore();

        // Get player's quest progress
        const progressDoc = await db.collection('questProgress').doc(playerId).get();
        const progressPayload = progressDoc.exists ? progressDoc.data() : {};
        const progressMap = progressPayload.quests || {};

        // Build quest list with progress
        const quests = QUEST_DEFINITIONS.map(def => {
            const progress = progressMap[def.id] || { progress: 0, completed: false, claimed: false, lastUpdated: 0 };
            const lastUpdatedMs = progress.lastUpdated?.toDate?.()?.getTime?.() || 0;

            // Check if quest should be reset
            const resetTimestamp = getResetTimestamp(def.resetType);
            if (resetTimestamp && lastUpdatedMs < resetTimestamp) {
                progress.progress = 0;
                progress.completed = false;
                progress.claimed = false;
            }

            return {
                id: def.id,
                type: def.type,
                title: def.title,
                description: def.description,
                target: def.target,
                reward: def.reward,
                resetType: def.resetType,
                progress: progress.progress,
                completed: progress.completed,
                claimed: progress.claimed
            };
        });

        res.json(quests);
    } catch (error) {
        logger.error('Get quests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/quests/:playerId/claim - Claim quest reward
router.post('/:playerId/claim', async (req, res) => {
    try {
        const { playerId } = req.params;
        const { questId } = req.body;

        if (!questId) {
            return res.status(400).json({ error: 'Quest ID is required' });
        }

        const db = getFirestore();
        const questDef = getQuestDefinition(questId);
        if (!questDef) {
            return res.status(404).json({ error: 'Quest not found' });
        }

        // Get quest progress
        const progressRef = db.collection('questProgress').doc(playerId);
        const progressDoc = await progressRef.get();

        if (!progressDoc.exists) {
            return res.status(404).json({ error: 'Quest progress not found' });
        }

        const progressPayload = progressDoc.data();
        const questsMap = progressPayload.quests || {};
        const questProgress = questsMap[questId];

        if (!questProgress) {
            return res.status(404).json({ error: 'Quest progress not found' });
        }

        const resetQuestProgress = resetProgressIfNeeded(questProgress, questDef.resetType);
        const resetPerformed = resetQuestProgress.progress !== questProgress.progress
            || resetQuestProgress.completed !== questProgress.completed
            || resetQuestProgress.claimed !== questProgress.claimed;

        if (resetPerformed) {
            await progressRef.set({
                quests: {
                    [questId]: {
                        ...resetQuestProgress,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    }
                }
            }, { merge: true });
        }

        if (!resetQuestProgress.completed) {
            return res.status(400).json({ error: 'Quest not completed yet' });
        }

        if (resetQuestProgress.claimed) {
            return res.status(400).json({ error: 'Reward already claimed' });
        }

        // Get player and update balance
        const playerRef = db.collection('players').doc(playerId);

        await db.runTransaction(async (transaction) => {
            const playerDoc = await transaction.get(playerRef);

            if (!playerDoc.exists) {
                throw new Error('Player not found');
            }

            const playerData = playerDoc.data();
            const currentTokens = Number(playerData.tokens || 0);

            // Update player balance
            transaction.update(playerRef, {
                tokens: currentTokens + questDef.reward,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Mark quest as claimed
            transaction.update(progressRef, {
                [`quests.${questId}.claimed`]: true,
                [`quests.${questId}.claimedAt`]: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        // Log transaction
        await logTransaction(db, {
            playerId,
            type: TRANSACTION_TYPES.EARN,
            amount: questDef.reward,
            reason: `Quest Completed: ${questDef.title}`
        });

        res.json({
            questId,
            reward: questDef.reward,
            message: `Claimed ${questDef.reward} tokens for completing "${questDef.title}"!`
        });
    } catch (error) {
        logger.error('Claim quest reward error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
