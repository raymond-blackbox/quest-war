import { admin, getFirestore } from './firebase.js';
import questRepository from '../repositories/quest.repository.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { logTransaction, TRANSACTION_TYPES } from '../routes/transactions.js';
import leaderboardService from './leaderboard.service.js';

export const QUEST_DEFINITIONS = [
    {
        id: 'daily_math_warrior',
        type: 'daily',
        title: 'Daily Warrior',
        description: 'Answer 25 questions correctly in any game',
        target: 25,
        reward: 50,
        resetType: 'daily'
    },
    {
        id: 'streak_master',
        type: 'streak',
        title: 'Streak Master',
        description: 'Win 3 games in a row',
        target: 3,
        reward: 100,
        resetType: 'daily'
    },
    {
        id: 'speed_demon',
        type: 'speed',
        title: 'Speed Demon',
        description: 'Answer 25 questions correctly in under 3 seconds each',
        target: 25,
        reward: 100,
        resetType: 'daily'
    },
    {
        id: 'social_butterfly',
        type: 'social',
        title: 'Social Butterfly',
        description: 'Play in 4 multiplayer rooms',
        target: 4,
        reward: 100,
        resetType: 'daily'
    },
    {
        id: 'collector_explorer',
        type: 'collector',
        title: 'Collector Explorer',
        description: 'Play games of all difficulty levels (Easy, Medium, Hard)',
        target: 3,
        reward: 150,
        resetType: 'daily'
    },
    {
        id: 'mastery_seeker',
        type: 'mastery',
        title: 'Mastery Seeker',
        description: 'Complete 10 hard difficulty games',
        target: 10,
        reward: 250,
        resetType: 'weekly'
    },
    {
        id: 'weekly_champion',
        type: 'weekly',
        title: 'Weekly Champion',
        description: 'Win 10 games this week',
        target: 10,
        reward: 250,
        resetType: 'weekly'
    },
    {
        id: 'perfectionist',
        type: 'streak',
        title: 'Perfectionist',
        description: 'Get 100% accuracy in a single game (10+ questions)',
        target: 1,
        reward: 500,
        resetType: 'weekly'
    }
];

export function getQuestDefinition(questId) {
    return QUEST_DEFINITIONS.find((quest) => quest.id === questId);
}

export function getResetTimestamp(resetType, now = new Date()) {
    if (resetType === 'daily') {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }
    if (resetType === 'weekly') {
        const dayOfWeek = now.getDay(); // 0 = Sunday
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        return startOfWeek.getTime();
    }
    return null;
}

function getLastUpdatedMs(progressData) {
    return progressData?.lastUpdated?.toDate?.()?.getTime?.() || 0;
}

export function resetProgressIfNeeded(progressData, resetType, now = new Date()) {
    const resetTimestamp = getResetTimestamp(resetType, now);
    if (resetTimestamp && getLastUpdatedMs(progressData) < resetTimestamp) {
        return {
            ...progressData,
            progress: 0,
            completed: false,
            claimed: false,
            difficulties: []
        };
    }
    return progressData;
}

function applyQuestProgressUpdate(questId, questDef, progressData, increment, gameData = {}) {
    if (progressData.completed) {
        return progressData;
    }

    let newProgress = Number(progressData.progress || 0);

    switch (questId) {
        case 'daily_math_warrior':
            newProgress += increment;
            break;
        case 'streak_master':
            newProgress = gameData?.won ? Math.min(newProgress + 1, questDef.target) : 0;
            break;
        case 'speed_demon':
            if (gameData?.fastCorrect === true
                || (gameData?.correct === true && gameData?.answerTime && gameData.answerTime < 3000)) {
                newProgress += increment;
            }
            break;
        case 'social_butterfly':
            if (gameData?.playerCount && gameData.playerCount >= 4) {
                newProgress += increment;
            }
            break;
        case 'mastery_seeker':
            if (gameData?.difficulty === 'hard' && gameData?.won) {
                newProgress += increment;
            }
            break;
        case 'collector_explorer': {
            const difficulties = Array.isArray(progressData.difficulties)
                ? [...progressData.difficulties]
                : [];
            if (gameData?.difficulty && !difficulties.includes(gameData.difficulty)) {
                difficulties.push(gameData.difficulty);
            }
            progressData.difficulties = difficulties;
            newProgress = difficulties.length;
            break;
        }
        case 'weekly_champion':
            if (gameData?.won) {
                newProgress += increment;
            }
            break;
        case 'perfectionist':
            if (gameData?.accuracy === 100 && gameData?.questionsCount >= 10) {
                newProgress = questDef.target;
            }
            break;
        default:
            newProgress += increment;
            break;
    }

    const resolvedProgress = Math.min(newProgress, questDef.target);
    return {
        ...progressData,
        progress: resolvedProgress,
        completed: resolvedProgress >= questDef.target
    };
}

export async function updateQuestProgress(playerId, questId, increment = 1, gameData = {}) {
    const questDef = getQuestDefinition(questId);
    if (!questDef) return null;

    const progressPayload = await questRepository.getProgress(playerId);
    const quests = progressPayload.quests || {};
    let questProgress = quests[questId] || {
        progress: 0,
        completed: false,
        claimed: false,
        difficulties: []
    };

    questProgress = resetProgressIfNeeded(questProgress, questDef.resetType);
    questProgress = applyQuestProgressUpdate(questId, questDef, questProgress, increment, gameData);
    questProgress.lastUpdated = admin.firestore.FieldValue.serverTimestamp();

    await questRepository.updateProgress(playerId, { [questId]: questProgress });
    return questProgress;
}

export async function updateMultipleQuestProgress(playerId, updates = []) {
    if (!Array.isArray(updates) || updates.length === 0) return null;

    const progressPayload = await questRepository.getProgress(playerId);
    const quests = progressPayload.quests || {};
    const questsUpdate = {};

    updates.forEach((update) => {
        const questId = update?.questId;
        const questDef = getQuestDefinition(questId);
        if (!questDef) return;

        let questProgress = quests[questId] || {
            progress: 0,
            completed: false,
            claimed: false,
            difficulties: []
        };

        questProgress = resetProgressIfNeeded(questProgress, questDef.resetType);
        questProgress = applyQuestProgressUpdate(
            questId,
            questDef,
            questProgress,
            update?.increment ?? 1,
            update?.gameData ?? {}
        );
        questProgress.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
        questsUpdate[questId] = questProgress;
    });

    if (Object.keys(questsUpdate).length === 0) return null;

    await questRepository.updateProgress(playerId, questsUpdate);
    return questsUpdate;
}

export class QuestService {
    async updateQuestProgress(playerId, questId, increment = 1, gameData = {}) {
        return updateQuestProgress(playerId, questId, increment, gameData);
    }

    async updateMultipleQuestProgress(playerId, updates = []) {
        return updateMultipleQuestProgress(playerId, updates);
    }

    async getPlayerQuests(playerId) {
        const progress = await questRepository.getProgress(playerId);
        // Merge definitions with progress
        const playerQuests = QUEST_DEFINITIONS.map(def => {
            const p = resetProgressIfNeeded(progress.quests?.[def.id] || { progress: 0 }, def.resetType);
            return {
                ...def,
                ...p
            };
        });
        return playerQuests;
    }

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

            // Mark quest as claimed (using dot notation for safety)
            transaction.update(progressRef, {
                [`quests.${questId}.claimed`]: true,
                [`quests.${questId}.claimedAt`]: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Sync with leaderboard
            leaderboardService.syncPlayerWithTransaction(transaction, playerId, {
                tokens: currentTokens + questDef.reward,
                totalTokensEarned: questDef.reward
            });
        });

        // Log transaction (mirroring original behavior: logging AFTER transaction)
        await logTransaction(db, {
            playerId,
            type: TRANSACTION_TYPES.EARN,
            amount: questDef.reward,
            reason: `Quest Completed: ${questDef.title}`
        });

        return {
            success: true,
            questId,
            reward: questDef.reward,
            message: `Claimed ${questDef.reward} tokens for completing "${questDef.title}"!`
        };
    }
}

export default new QuestService();
