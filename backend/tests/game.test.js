import { describe, it, expect, vi, beforeEach } from 'vitest';
import './testSetup.js';
import request from 'supertest';
import { app } from '../src/index.js';
import { admin, getRealtimeDb, getFirestore } from '../src/services/firebase.js';
import { getAuthHeader, mockUser } from './testSetup.js';

// Mock Question Providers
vi.mock('../src/services/questionProviders/index.js', () => {
    const mockProvider = {
        generateQuestion: vi.fn().mockResolvedValue({
            question: 'What is 1+1?',
            options: ['1', '2', '3', '4'],
            correctIndex: 1
        }),
        DIFFICULTY: { EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' }
    };
    return {
        getQuestionProvider: vi.fn().mockReturnValue(mockProvider),
        GAME_TYPES: { MATH: 'math', SCIENCE: 'science' }
    };
});

describe('Game API', () => {
    const roomId = 'room-123';

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset default mock behaviors
        admin.auth().verifyIdToken.mockResolvedValue(mockUser);
    });

    describe('Authentication & Authorization', () => {
        it('should return 401 if no auth header is provided', async () => {
            const response = await request(app).post(`/api/game/${roomId}/start`);
            expect(response.status).toBe(401);
        });

        it('should return 403 if user is not the host (for start)', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    hostId: 'other-user',
                    players: { [mockUser.uid]: { ready: true } }
                })
            });

            const response = await request(app)
                .post(`/api/game/${roomId}/start`)
                .set(getAuthHeader());

            expect(response.status).toBe(403);
            expect(response.body.error).toContain('Only host');
        });
    });

    describe('POST /api/game/:roomId/start', () => {
        it('should return 404 if room does not exist', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({ exists: () => false });

            const response = await request(app)
                .post(`/api/game/${roomId}/start`)
                .set(getAuthHeader());

            expect(response.status).toBe(404);
        });

        it('should return 400 if not enough players for multiplayer', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    hostId: mockUser.uid,
                    isSolo: false,
                    players: { [mockUser.uid]: { ready: true } }
                })
            });

            const response = await request(app)
                .post(`/api/game/${roomId}/start`)
                .set(getAuthHeader());

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('at least 2 players');
        });

        it('should return 400 if players are not ready', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    hostId: mockUser.uid,
                    isSolo: false,
                    players: {
                        [mockUser.uid]: { ready: true },
                        'player-2': { ready: false }
                    }
                })
            });

            const response = await request(app)
                .post(`/api/game/${roomId}/start`)
                .set(getAuthHeader());

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('must be ready');
        });

        it('should start solo game successfully', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    hostId: mockUser.uid,
                    isSolo: true,
                    settings: { questionsCount: 5 },
                    players: { [mockUser.uid]: { ready: true } }
                })
            });

            const response = await request(app)
                .post(`/api/game/${roomId}/start`)
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify RTDB update
            expect(getRealtimeDb().ref().update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'starting',
                totalQuestions: 5
            }));
        });
    });

    describe('POST /api/game/:roomId/answer', () => {
        it('should return 400 for missing answerIndex', async () => {
            const response = await request(app)
                .post(`/api/game/${roomId}/answer`)
                .set(getAuthHeader())
                .send({ playerUsername: 'test' });

            expect(response.status).toBe(400);
        });

        it('should return 400 if game is not in progress', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    status: 'waiting',
                    players: { [mockUser.uid]: {} }
                })
            });

            const response = await request(app)
                .post(`/api/game/${roomId}/answer`)
                .set(getAuthHeader())
                .send({ answerIndex: 0, playerUsername: 'test' });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('not in progress');
        });

        it('should submit correct answer and update RTDB', async () => {
            const roomData = {
                status: 'playing',
                currentQuestion: { correctIndex: 1, startedAt: Date.now() },
                players: { [mockUser.uid]: { score: 10, tokensEarned: 5 } },
                settings: { tokenPerCorrectAnswer: 2 }
            };

            // First get: roomRef.get()
            // Second get: playerRef.get()
            getRealtimeDb().ref().get
                .mockResolvedValueOnce({
                    exists: () => true,
                    val: () => roomData
                })
                .mockResolvedValueOnce({
                    exists: () => true,
                    val: () => roomData.players[mockUser.uid]
                });

            const response = await request(app)
                .post(`/api/game/${roomId}/answer`)
                .set(getAuthHeader())
                .send({ answerIndex: 1, playerUsername: 'test' });

            expect(response.status).toBe(200);
            expect(response.body.correct).toBe(true);
            expect(response.body.tokenReward).toBe(2);

            // Verify score update
            // Note: with current mockRtdb, all updates go to the same mock function
            expect(getRealtimeDb().ref().update).toHaveBeenCalledWith(expect.objectContaining({
                score: 11,
                tokensEarned: 7
            }));
        });

        it('should handle incorrect answer', async () => {
            const roomData = {
                status: 'playing',
                currentQuestion: { correctIndex: 1, startedAt: Date.now() },
                players: { [mockUser.uid]: {} }
            };

            // First get: roomRef.get() in answering logic
            // Second get: roomRef.get() in checkRoundCompletion
            getRealtimeDb().ref().get
                .mockResolvedValueOnce({
                    exists: () => true,
                    val: () => roomData
                })
                .mockResolvedValueOnce({
                    exists: () => true,
                    val: () => roomData
                });

            const response = await request(app)
                .post(`/api/game/${roomId}/answer`)
                .set(getAuthHeader())
                .send({ answerIndex: 0, playerUsername: 'test' });

            expect(response.status).toBe(200);
            expect(response.body.correct).toBe(false);

            // Verify incorrect answer record
            expect(getRealtimeDb().ref().set).toHaveBeenCalledWith(true);
        });

        it('should prevent multiple answers from same player', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    status: 'playing',
                    currentQuestion: {
                        correctIndex: 1,
                        incorrectAnswers: { [mockUser.uid]: true }
                    }
                })
            });

            const response = await request(app)
                .post(`/api/game/${roomId}/answer`)
                .set(getAuthHeader())
                .send({ answerIndex: 1, playerUsername: 'test' });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('already answered this question incorrectly');
        });
    });

    describe('Security & XSS', () => {
        it('should reject XSS payloads via validation (400 Bad Request)', async () => {
            const xssPayload = '<script>alert("xss")</script>';
            const response = await request(app)
                .post(`/api/game/${roomId}/answer`)
                .set(getAuthHeader())
                .send({ answerIndex: 1, playerUsername: xssPayload });

            // The safeString validation schema rejects characters like < > /
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Validation');
        });
    });

    describe('POST /api/game/:roomId/quit', () => {
        it('should quit game and remove player', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    status: 'playing',
                    players: {
                        [mockUser.uid]: { username: 'test' },
                        'other-player': {}
                    },
                    hostId: mockUser.uid
                })
            });

            const response = await request(app)
                .post(`/api/game/${roomId}/quit`)
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify player removal
            const playerRef = getRealtimeDb().ref(`rooms/${roomId}/players/${mockUser.uid}`);
            expect(playerRef.remove).toHaveBeenCalled();

            // Verify host reassignment
            expect(getRealtimeDb().ref(`rooms/${roomId}`).update).toHaveBeenCalledWith(expect.objectContaining({
                hostId: 'other-player'
            }));
        });
    });

    describe('POST /api/game/:roomId/reset', () => {
        it('should reset game if ended', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    status: 'ended',
                    hostId: mockUser.uid,
                    players: { [mockUser.uid]: {} }
                })
            });

            const response = await request(app)
                .post(`/api/game/${roomId}/reset`)
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            expect(getRealtimeDb().ref(`rooms/${roomId}`).update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'waiting'
            }));
        });

        it('should return 400 if reset attempted during play', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    status: 'playing',
                    hostId: mockUser.uid
                })
            });

            const response = await request(app)
                .post(`/api/game/${roomId}/reset`)
                .set(getAuthHeader());

            expect(response.status).toBe(400);
        });
    });
});
