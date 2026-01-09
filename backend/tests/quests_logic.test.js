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
                serverTimestamp: () => 'MOCK_TIMESTAMP'
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
    lastUpdated: { toDate: () => new Date() },
    ...overrides
});

describe('Quest Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Daily Math Warrior', () => {
        it('should increment progress for correct answers', async () => {
            const playerId = 'player-123';
            const questId = 'daily_math_warrior';

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress({ progress: 5 })
                }
            });

            await questService.updateQuestProgress(playerId, questId, 3, { correct: true });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 8,
                    completed: false
                })
            }));
        });
    });

    describe('Streak Master', () => {
        it('should increment streak on win', async () => {
            const playerId = 'player-123';
            const questId = 'streak_master';

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress({ progress: 2 })
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, { won: true });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 3,
                    completed: true
                })
            }));
        });

        it('should reset streak on loss', async () => {
            const playerId = 'player-123';
            const questId = 'streak_master';

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress({ progress: 2 })
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, { won: false });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 0,
                    completed: false
                })
            }));
        });
    });

    describe('Speed Demon', () => {
        it('should increment progress for fast correct answers', async () => {
            const playerId = 'player-123';
            const questId = 'speed_demon';

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress()
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, { fastCorrect: true });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 1,
                    completed: false
                })
            }));
        });

        it('should not increment progress for slow answers', async () => {
            const playerId = 'player-123';
            const questId = 'speed_demon';

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress({ progress: 2 })
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, {
                correct: true,
                answerTime: 3500
            });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 2,
                    completed: false
                })
            }));
        });
    });

    describe('Social Butterfly', () => {
        it('should increment progress for multiplayer rooms', async () => {
            const playerId = 'player-123';
            const questId = 'social_butterfly';

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress({ progress: 1 })
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, { playerCount: 4 });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 2,
                    completed: false
                })
            }));
        });
    });

    describe('Mastery Seeker', () => {
        it('should increment progress for hard wins', async () => {
            const playerId = 'player-123';
            const questId = 'mastery_seeker';

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress({ progress: 4 })
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, {
                difficulty: 'hard',
                won: true
            });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 5,
                    completed: false
                })
            }));
        });
    });

    describe('Weekly Champion', () => {
        it('should increment progress on wins', async () => {
            const playerId = 'player-123';
            const questId = 'weekly_champion';

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress({ progress: 9 })
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, { won: true });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 10,
                    completed: true
                })
            }));
        });
    });

    describe('Perfectionist', () => {
        it('should complete quest on perfect accuracy with enough questions', async () => {
            const playerId = 'player-123';
            const questId = 'perfectionist';

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress()
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, {
                accuracy: 100,
                questionsCount: 10
            });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    progress: 1,
                    completed: true
                })
            }));
        });
    });

    describe('Collector Explorer', () => {
        it('should update progress when playing a game even if not won', async () => {
            const playerId = 'player-123';
            const questId = 'collector_explorer';

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress()
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, {
                difficulty: 'hard',
                won: false
            });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    difficulties: ['hard'],
                    progress: 1
                })
            }));
        });

        it('should update progress when playing a game and winning', async () => {
            const playerId = 'player-123';
            const questId = 'collector_explorer';

            questRepository.getProgress.mockResolvedValue({
                quests: {
                    [questId]: buildQuestProgress()
                }
            });

            await questService.updateQuestProgress(playerId, questId, 1, {
                difficulty: 'easy',
                won: true
            });

            expect(questRepository.updateProgress).toHaveBeenCalledWith(playerId, expect.objectContaining({
                [questId]: expect.objectContaining({
                    difficulties: ['easy'],
                    progress: 1
                })
            }));
        });
    });
});
