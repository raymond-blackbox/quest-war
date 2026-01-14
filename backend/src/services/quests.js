import { admin, getFirestore } from './firebase.js';
import questRepository from '../repositories/quest.repository.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { transactionService, TRANSACTION_TYPES } from './transaction.service.js';
import leaderboardService from './leaderboard.service.js';

export const QUEST_DEFINITIONS = [
    {
        id: 'daily_math_warrior',
        title: 'Daily Math Warrior',
        description: 'Answer 20 math questions correctly in a single day.',
        reward: 100,
        target: 20,
        type: 'count', // progressive count
        resetType: 'daily',
        criteria: { type: 'count' }
    },
    {
        id: 'speed_demon',
        title: 'Speed Demon',
        description: 'Answer 5 questions correctly in under 3 seconds each.',
        reward: 150,
        target: 5,
        type: 'count',
        resetType: 'daily',
        criteria: { type: 'speed', maxTimeMs: 3000 }
    },
    {
        id: 'streak_master',
        title: 'Streak Master',
        description: 'Win 3 games in a row.',
        reward: 250,
        target: 3,
        type: 'streak',
        resetType: 'daily',
        criteria: { type: 'streak' }
    },
    {
        id: 'perfectionist',
        title: 'Perfectionist',
        description: 'Win a game with 100% accuracy (minimum 10 questions).',
        reward: 300,
        target: 1,
        type: 'achievement',
        resetType: 'daily',
        criteria: { type: 'accuracy', minAccuracy: 100, minQuestions: 10 }
    },
    {
        id: 'collector_explorer',
        title: 'Collector Explorer',
        description: 'Participate in games of every difficulty level (Easy, Medium, Hard).',
        reward: 200,
        target: 3,
        type: 'collection',
        resetType: 'daily',
        criteria: { type: 'collection', collectionField: 'difficulty' }
    },
    {
        id: 'social_butterfly',
        title: 'Social Butterfly',
        description: 'Participate in a game with 4 or more players.',
        reward: 150,
        target: 1,
        type: 'achievement',
        resetType: 'weekly',
        criteria: { type: 'condition', field: 'playerCount', operator: '>=', value: 4 }
    },
    {
        id: 'weekly_champion',
        title: 'Weekly Champion',
        description: 'Win 15 games in a single week.',
        reward: 500,
        target: 15,
        type: 'count', // cumulative count
        resetType: 'weekly',
        criteria: { type: 'count' }
    },
    {
        id: 'mastery_seeker',
        title: 'Mastery Seeker',
        description: 'Achieve a total of 500 correct answers across all games.',
        reward: 1000,
        target: 500,
        type: 'count',
        resetType: 'weekly',
        criteria: { type: 'count' }
    }
];

function getQuestDefinition(questId) {
    return QUEST_DEFINITIONS.find(q => q.id === questId);
}

const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

const isSameWeek = (d1, d2) => {
    // Basic week check (starting Sunday)
    const getWeekNumber = (d) => {
        const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
        const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    };
    return d1.getFullYear() === d2.getFullYear() && getWeekNumber(d1) === getWeekNumber(d2);
};

const resetProgressIfNeeded = (p, resetType) => {
    const timestamp = p.updatedAt || p.lastUpdated;
    if (!timestamp) return p;
    const lastUpdate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();

    if (resetType === 'daily' && !isSameDay(lastUpdate, now)) {
        return { ...p, progress: 0, completed: false, claimed: false };
    }
    if (resetType === 'weekly' && !isSameWeek(lastUpdate, now)) {
        return { ...p, progress: 0, completed: false, claimed: false };
    }
    return p;
};

// Evaluators for different quest criteria
const QUEST_EVALUATORS = {
    // Standard counter: simply adds increment
    count: (quest, gameData, increment) => {
        return { progress: (quest.progress || 0) + increment, changed: increment > 0 };
    },

    // Speed: checks if answerTime < maxTimeMs OR fastCorrect flag
    speed: (quest, gameData, increment, criteria) => {
        const passed = gameData.fastCorrect || (gameData.answerTime && gameData.answerTime < criteria.maxTimeMs);
        if (passed) {
            return { progress: (quest.progress || 0) + increment, changed: true };
        }
        return { progress: quest.progress, changed: false };
    },

    // Streak: +1 on win, 0 on loss
    streak: (quest, gameData, increment) => {
        if (gameData.won === true) {
            return { progress: (quest.progress || 0) + 1, changed: true };
        } else if (gameData.won === false) {
            return { progress: 0, changed: true };
        }
        return { progress: quest.progress, changed: false };
    },

    // Collection: tracks unique values in a list (e.g., difficulties)
    collection: (quest, gameData, increment, criteria) => {
        const field = criteria.collectionField;
        const val = gameData[field];
        if (val) {
            const currentList = quest.difficulties || [];
            if (!currentList.includes(val)) {
                const newList = [...currentList, val];
                return {
                    progress: newList.length,
                    difficulties: newList, // Updates the storage array
                    changed: true
                };
            }
        }
        return { progress: quest.progress, changed: false };
    },

    // Accuracy: checks if accuracy >= min and count >= min
    accuracy: (quest, gameData, increment, criteria) => {
        if (gameData.accuracy >= criteria.minAccuracy && gameData.questionsCount >= criteria.minQuestions) {
            // Achievement type usually sets progress to target (1) immediately
            return { progress: 1, changed: true };
        }
        return { progress: quest.progress, changed: false };
    },

    // General Condition: checks specific field against value
    condition: (quest, gameData, increment, criteria) => {
        const val = gameData[criteria.field];
        if (val === undefined) return { progress: quest.progress, changed: false };

        let met = false;
        switch (criteria.operator) {
            case '>=': met = val >= criteria.value; break;
            case '<=': met = val <= criteria.value; break;
            case '>': met = val > criteria.value; break;
            case '<': met = val < criteria.value; break;
            case '===': met = val === criteria.value; break;
        }

        if (met) {
            return { progress: 1, changed: true };
        }
        return { progress: quest.progress, changed: false };
    }
};


export const questService = {
    async getPlayerQuests(playerId) {
        const progress = await questRepository.getProgress(playerId);
        // Merge definitions with progress
        const playerQuests = QUEST_DEFINITIONS.map(def => {
            const questProgress = progress.quests?.[def.id] || { progress: 0 };
            const p = resetProgressIfNeeded(questProgress, def.resetType);
            return {
                ...def,
                ...p
            };
        });

        return playerQuests;
    },

    async claimQuestReward(playerId, questId) {
        const questDef = getQuestDefinition(questId);
        if (!questDef) throw new AppError('Quest not found', 404);

        const db = getFirestore();
        const playerRef = db.collection('players').doc(playerId);
        const progressRef = db.collection('questProgress').doc(playerId);

        await db.runTransaction(async (transaction) => {
            const [playerDoc, progressDoc] = await Promise.all([
                transaction.get(playerRef),
                transaction.get(progressRef)
            ]);

            if (!playerDoc.exists) throw new NotFoundError('Player not found');
            if (!progressDoc.exists) throw new AppError('Quest progress not found', 404);

            const progressData = progressDoc.data();
            const quests = progressData.quests || {};
            const questProgress = quests[questId];

            if (!questProgress) throw new AppError('Quest progress not found', 404);

            // Check if reset is needed
            const resetQuestProgress = resetProgressIfNeeded(questProgress, questDef.resetType);
            if (!resetQuestProgress.completed) {
                throw new AppError('Quest not completed yet', 400);
            }
            if (resetQuestProgress.claimed) {
                throw new AppError('Reward already claimed', 400);
            }

            // Update player balance
            const currentTokens = Number(playerDoc.data().tokens || 0);
            transaction.update(playerRef, {
                tokens: currentTokens + questDef.reward,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Mark quest as claimed
            const updatedQuests = { ...quests };
            updatedQuests[questId] = {
                ...resetQuestProgress,
                claimed: true,
                claimedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            transaction.update(progressRef, {
                quests: updatedQuests,
                lastClaimAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        // Log transaction (mirroring original behavior: logging AFTER transaction)
        await transactionService.logTransaction(db, {
            playerId,
            type: TRANSACTION_TYPES.EARN,
            amount: questDef.reward,
            reason: `Quest Completed: ${questDef.title}`
        });

        return {
            success: true,
            questId,
            reward: questDef.reward
        };
    },

    /**
     * Update progress for a single quest
     */
    async updateQuestProgress(playerId, questId, increment = 0, gameData = {}) {
        return this.updateMultipleQuestProgress(playerId, [{ questId, increment, gameData }]);
    },

    /**
     * Update progress for multiple quests at once
     */
    async updateMultipleQuestProgress(playerId, updates) {
        if (!updates || updates.length === 0) return;

        try {
            const progress = await questRepository.getProgress(playerId);
            const currentQuests = progress.quests || {};
            const newQuests = { ...currentQuests };
            let processedAtLeastOne = false;

            for (const update of updates) {
                const { questId, increment = 0, gameData = {} } = update;
                const def = getQuestDefinition(questId);
                if (!def) continue;

                // Use existing or initialize with defaults
                let qp = currentQuests[def.id] || {
                    progress: 0,
                    completed: false,
                    claimed: false,
                    difficulties: []
                };

                // Run reset logic if needed
                qp = resetProgressIfNeeded(qp, def.resetType);


                if (qp.completed && !def.resetType) continue;

                // --- DATA DRIVEN APPROACH ---
                // Find criteria type, default to 'count'
                const criteriaType = def.criteria?.type || 'count';
                const evaluator = QUEST_EVALUATORS[criteriaType] || QUEST_EVALUATORS.count;

                const result = evaluator(qp, gameData, increment, def.criteria);

                if (result.changed) {
                    qp.progress = result.progress;
                    // If the evaluator returned extra fields (like 'difficulties' for collection), merge them
                    if (result.difficulties) qp.difficulties = result.difficulties;

                    if (qp.progress >= def.target) {
                        qp.progress = def.target;
                        qp.completed = true;
                        qp.completedAt = admin.firestore.FieldValue.serverTimestamp();
                    }
                }

                // Always update metadata if processed (Matches legacy behavior)
                qp.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                newQuests[def.id] = qp;
                processedAtLeastOne = true;
            }

            if (processedAtLeastOne) {
                // We create a snapshot copy to ensure mock history is preserved
                // while still allow shared object mutations if the test environment relies on it.
                const snapshot = {};
                for (const qid in newQuests) {
                    snapshot[qid] = { ...newQuests[qid] };
                }
                await questRepository.updateProgress(playerId, snapshot);
            }


        } catch (error) {
            logger.error(`Error updating quests for player ${playerId}:`, error);
        }
    }

};

export const updateMultipleQuestProgress = questService.updateMultipleQuestProgress.bind(questService);
export const updateQuestProgress = questService.updateQuestProgress.bind(questService);
export default questService;
