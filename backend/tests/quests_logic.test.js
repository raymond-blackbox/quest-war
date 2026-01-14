import { describe, it, expect, vi, beforeEach } from 'vitest';
import questService from '../src/services/quests.js';
import questRepository from '../src/repositories/quest.repository.js';
import { admin } from '../src/services/firebase.js';

// Mock dependencies
vi.mock('../src/repositories/quest.repository.js');
vi.mock('../src/services/firebase.js', () => ({
    admin: {
        firestore: {
            FieldValue: {
                serverTimestamp: () => ({ toDate: () => new Date() })
            }
        }
    },
    getFirestore: vi.fn()
}));
vi.mock('../src/routes/transactions.js', () => ({
    logTransaction: vi.fn(),
    TRANSACTION_TYPES: {}
}));
vi.mock('../src/services/leaderboard.service.js', () => ({
    default: {
        syncPlayerWithTransaction: vi.fn()
    }
}));

const buildQuestProgress = (overrides = {}) => ({
    progress: 0,
    completed: false,
    claimed: false,
    difficulties: [],
    lastUpdated: { toDate: () => new Date() }, // Default to now (no reset)
    ...overrides
});

describe('Quest Logic', () => {
    const playerId = 'player-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Quest Reset Logic', () => {
        it('should reset daily quest if last update was yesterday', async () => {
            const questId = 'daily_math_warrior';
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress({
                        progress: 10,
                        lastUpdated: { toDate: () => yesterday }
                    })
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, { correct: true });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 1, // 0 (reset) + 1 (new update)
                    completed: false
                })
            }));
        });

        it('should NOT reset weekly quest if last update was yesterday (different reset period)', async () => {
            const questId = 'weekly_champion';
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress({
                        progress: 5,
                        lastUpdated: { toDate: () => yesterday }
                    })
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, { won: true });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 6, // 5 (no reset) + 1 (new update)
                    completed: false
                })
            }));
        });
    });

    describe('Empty/Missing Data Handling', () => {
        it('should initialize quest progress if missing in repository', async () => {
            const questId = 'daily_math_warrior';
            questRepository.getProgress.mockResolvedValue({}); // Empty results

            await questService.updateQuestProgress(playerId, questId, 5, { correct: true });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 5,
                    completed: false,
                    claimed: false
                })
            }));
        });
    });

    describe('Specific Quest Types', () => {
        it('Streak Master: should reset streak on loss', async () => {
            const questId = 'streak_master';
            questRepository.getProgress.mockResolvedValue({
                quests: { [questId]: buildQuestProgress({ progress: 2 }) }
            });

            await questService.updateQuestProgress(playerId, questId, 1, { won: false });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, {
                [questId]: expect.objectContaining({ progress: 0 })
            });
        });

        it('Speed Demon: should only count fast answers', async () => {
            const questId = 'speed_demon';
            questRepository.getProgress.mockResolvedValue({
                quests: { [questId]: buildQuestProgress({ progress: 0 }) }
            });

            // Too slow
            await questService.updateQuestProgress(playerId, questId, 1, { correct: true, answerTime: 5000 });
            // Fast
            await questService.updateQuestProgress(playerId, questId, 1, { fastCorrect: true });

            const calls = questRepository.updateProgress.mock.calls;
            expect(calls[0][1][questId].progress).toBe(0);
            expect(calls[1][1][questId].progress).toBe(1);
        });

        it('Collector Explorer: should track unique difficulties', async () => {
            const questId = 'collector_explorer';
            let currentQuestState = buildQuestProgress({ difficulties: ['easy'], progress: 1 }); // Initial state

            // Stateful mock implementation
            questRepository.getProgress.mockImplementation(async () => ({
                quests: { [questId]: currentQuestState }
            }));

            questRepository.updateProgress.mockImplementation(async (pid, updates) => {
                if (updates[questId]) {
                    // Update internal state with what was passed to updateProgress
                    currentQuestState = { ...currentQuestState, ...updates[questId] };
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, { difficulty: 'medium' });
            await questService.updateQuestProgress(playerId, questId, 1, { difficulty: 'easy' }); // Duplicate

            expect(currentQuestState.difficulties).toContain('easy');
            expect(currentQuestState.difficulties).toContain('medium');
            expect(currentQuestState.progress).toBe(2);
        });
    });

    describe('updateMultipleQuestProgress', () => {
        it('should update multiple quests in a single call', async () => {
            questRepository.getProgress.mockResolvedValue({
                quests: {
                    'daily_math_warrior': buildQuestProgress({ progress: 10 })
                }
            });

            const updates = [
                { questId: 'daily_math_warrior', increment: 5 },
                { questId: 'streak_master', gameData: { won: true } }
            ];

            await questService.updateMultipleQuestProgress(playerId, updates);

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, {
                'daily_math_warrior': expect.objectContaining({ progress: 15 }),
                'streak_master': expect.objectContaining({ progress: 1 })
            });
        });
    });
});
