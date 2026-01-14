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
        resetType: 'daily'
    },
    {
        id: 'speed_demon',
        title: 'Speed Demon',
        description: 'Answer 5 questions correctly in under 3 seconds each.',
        reward: 150,
        target: 5,
        type: 'count',
        resetType: 'daily'
    },
    {
        id: 'streak_master',
        title: 'Streak Master',
        description: 'Win 3 games in a row.',
        reward: 250,
        target: 3,
        type: 'streak',
        resetType: 'daily'
    },
    {
        id: 'perfectionist',
        title: 'Perfectionist',
        description: 'Win a game with 100% accuracy (minimum 10 questions).',
        reward: 300,
        target: 1,
        type: 'achievement',
        resetType: 'daily'
    },
    {
        id: 'collector_explorer',
        title: 'Collector Explorer',
        description: 'Participate in games of every difficulty level (Easy, Medium, Hard).',
        reward: 200,
        target: 3,
        type: 'collection',
        resetType: 'daily'
    },
    {
        id: 'social_butterfly',
        title: 'Social Butterfly',
        description: 'Participate in a game with 4 or more players.',
        reward: 150,
        target: 1,
        type: 'achievement',
        resetType: 'weekly'
    },
    {
        id: 'weekly_champion',
        title: 'Weekly Champion',
        description: 'Win 15 games in a single week.',
        reward: 500,
        target: 15,
        type: 'count', // cumulative count
        resetType: 'weekly'
    },
    {
        id: 'mastery_seeker',
        title: 'Mastery Seeker',
        description: 'Achieve a total of 500 correct answers across all games.',
        reward: 1000,
        target: 500,
        type: 'count',
        resetType: 'weekly'
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

                let progressChanged = false;

                // Handle different quest definitions specifically or by type
                switch (def.id) {
                    case 'speed_demon':
                        if (gameData.fastCorrect || (gameData.answerTime && gameData.answerTime < 3000)) {
                            qp.progress += increment;
                            progressChanged = true;
                        }
                        break;

                    case 'streak_master':
                        if (gameData.won === true) {
                            qp.progress += 1;
                            progressChanged = true;
                        } else if (gameData.won === false) {
                            qp.progress = 0;
                            progressChanged = true;
                        }
                        break;
                    case 'collector_explorer':
                        const difficulties = qp.difficulties || [];
                        if (gameData.difficulty && !difficulties.includes(gameData.difficulty)) {
                            difficulties.push(gameData.difficulty);
                            qp.difficulties = difficulties;
                            qp.progress = difficulties.length;
                            progressChanged = true;
                        }
                        break;
                    case 'perfectionist':
                        if (gameData.accuracy >= 100 && gameData.questionsCount >= 10) {
                            qp.progress = 1;
                            progressChanged = true;
                        }
                        break;
                    case 'social_butterfly':
                        if (gameData.playerCount >= 4) {
                            qp.progress = 1;
                            progressChanged = true;
                        }
                        break;
                    default:
                        if (def.type === 'count') {
                            qp.progress += increment;
                            progressChanged = true;
                        }
                        break;
                }

                if (progressChanged && qp.progress >= def.target) {
                    qp.progress = def.target;
                    qp.completed = true;
                    qp.completedAt = admin.firestore.FieldValue.serverTimestamp();
                }

                // Always update metadata if processed
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
