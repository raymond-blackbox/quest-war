import { describe, it, expect, vi, beforeEach } from 'vitest';
import './testSetup.js';
import request from 'supertest';
import { app } from '../src/index.js';
import { admin, getFirestore } from '../src/services/firebase.js';
import { getAuthHeader, mockUser } from './testSetup.js';

describe('Quests API', () => {
    const otherPlayerId = 'other-player-id';
    const questId = 'streak_master';

    beforeEach(() => {
        vi.clearAllMocks();
        admin.auth().verifyIdToken.mockResolvedValue(mockUser);
    });

    const makeSnapshot = (data, id = questId) => ({
        exists: !!data,
        id,
        path: `quests/${id}`,
        data: () => data,
        get: async () => ({ exists: !!data, id, data: () => data })
    });

    describe('Authentication & Authorization', () => {
        it('should return 401 if no auth header is provided', async () => {
            const endpoints = [
                { method: 'get', path: `/api/quests/${mockUser.uid}` },
                { method: 'post', path: `/api/quests/${mockUser.uid}/claim/${questId}` },
            ];

            for (const { method, path } of endpoints) {
                const response = await request(app)[method](path);
                expect(response.status).toBe(401);
            }
        });

        it('should return 403 if user attempts to view another player\'s quests', async () => {
            const response = await request(app)
                .get(`/api/quests/${otherPlayerId}`)
                .set(getAuthHeader());

            expect(response.status).toBe(403);
            expect(response.body.error).toContain('own quests');
        });

        it('should return 403 if user attempts to claim another player\'s quest', async () => {
            const response = await request(app)
                .post(`/api/quests/${otherPlayerId}/claim/${questId}`)
                .set(getAuthHeader());

            expect(response.status).toBe(403);
        });
    });

    describe('GET /api/quests/:playerId', () => {
        it('should return player quests successfully', async () => {
            const firstQuestId = 'daily_math_warrior';
            const mockQuestDoc = makeSnapshot({ name: 'Daily Warrior', status: 'available' }, firstQuestId);

            getFirestore().collection('playerQuests').get.mockResolvedValueOnce({
                empty: false,
                docs: [mockQuestDoc],
                forEach: (cb) => cb(mockQuestDoc)
            });

            const response = await request(app)
                .get(`/api/quests/${mockUser.uid}`)
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            // The service returns all definitions, so let's check the first one
            expect(response.body[0].id).toBe(firstQuestId);
        });
    });

    describe('POST /api/quests/:playerId/claim/:questId', () => {
        it('should claim quest reward successfully', async () => {
            const mockProgressData = {
                quests: {
                    [questId]: {
                        progress: 3,
                        completed: true,
                        claimed: false,
                        lastUpdated: { toDate: () => new Date() } // Recent timestamp
                    }
                }
            };

            getFirestore().runTransaction.mockImplementation(async (callback) => {
                return callback({
                    get: vi.fn().mockImplementation((ref) => {
                        // Check if it's the players or questProgress collection
                        // In some mock environments, ref might have a .path or we can check the spy on collection()
                        const refId = ref.id || mockUser.uid;

                        if (getFirestore().collection.mock.calls.some(call => call[0] === 'players')) {
                            // This is still tricky with singleton mocks. 
                            // Let's rely on the fact that we know what's being requested.
                            if (ref._path?.includes('players') || ref.path?.includes('players')) {
                                return Promise.resolve({ exists: true, data: () => ({ tokens: 100 }) });
                            }
                        }

                        // Fallback to simpler matching if paths aren't cooperative
                        return Promise.resolve({ exists: true, data: () => ({ tokens: 100, quests: { [questId]: { ...mockProgressData.quests[questId] } } }) });
                    }),
                    update: vi.fn(),
                    set: vi.fn()
                });
            });

            const response = await request(app)
                .post(`/api/quests/${mockUser.uid}/claim/${questId}`)
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.reward).toBeGreaterThan(0);
        });

        it('should return 404 for unknown quest', async () => {
            getFirestore().runTransaction.mockImplementation(async (callback) => {
                return callback({
                    get: vi.fn().mockImplementation((ref) => {
                        if (ref.path?.includes('questProgress')) {
                            return Promise.resolve({ exists: false });
                        }
                        return Promise.resolve({ exists: true, data: () => ({}) });
                    }),
                    update: vi.fn(),
                    set: vi.fn()
                });
            });

            const response = await request(app)
                .post(`/api/quests/${mockUser.uid}/claim/unknown_quest`)
                .set(getAuthHeader());

            expect(response.status).toBe(404);
            expect(response.body.error).toContain('not found');
        });

        it('should return 400 if quest is already claimed', async () => {
            const mockProgressData = {
                quests: {
                    [questId]: { completed: true, claimed: true, lastUpdated: { toDate: () => new Date() } }
                }
            };

            getFirestore().runTransaction.mockImplementation(async (callback) => {
                return callback({
                    get: vi.fn().mockImplementation(() => Promise.resolve({ exists: true, data: () => mockProgressData })),
                    update: vi.fn(),
                    set: vi.fn()
                });
            });

            const response = await request(app)
                .post(`/api/quests/${mockUser.uid}/claim/${questId}`)
                .set(getAuthHeader());

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('already claimed');
        });

        it('should return 400 if quest is not completed yet', async () => {
            const mockProgressData = {
                quests: {
                    [questId]: { completed: false, claimed: false, lastUpdated: { toDate: () => new Date() } }
                }
            };

            getFirestore().runTransaction.mockImplementation(async (callback) => {
                return callback({
                    get: vi.fn().mockImplementation(() => Promise.resolve({ exists: true, data: () => mockProgressData })),
                    update: vi.fn(),
                    set: vi.fn()
                });
            });

            const response = await request(app)
                .post(`/api/quests/${mockUser.uid}/claim/${questId}`)
                .set(getAuthHeader());

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('not completed');
        });
    });

    describe('Security & XSS', () => {
        it('should reject XSS payloads in playerId via validation', async () => {
            const xssPayload = '<script>alert(1)</script>';
            const response = await request(app)
                .get(`/api/quests/${encodeURIComponent(xssPayload)}`)
                .set(getAuthHeader());

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Validation');
        });

        it('should reject XSS payloads in questId via validation', async () => {
            const xssPayload = '<script>alert(1)</script>';
            const response = await request(app)
                .post(`/api/quests/${mockUser.uid}/claim/${encodeURIComponent(xssPayload)}`)
                .set(getAuthHeader());

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Validation');
        });
    });
});
