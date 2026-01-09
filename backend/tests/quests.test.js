import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock Firebase BEFORE importing app or routes
vi.mock('../src/services/firebase.js', () => {
    const mockAuthSingleton = {
        verifyIdToken: vi.fn(),
    };

    const makeMockDoc = (id = 'test-id', data = {}, collectionName = 'unknown') => ({
        exists: true,
        id,
        path: `${collectionName}/${id}`,
        data: vi.fn().mockReturnValue({
            uid: id,
            username: 'testuser',
            tokens: 1000,
            status: 'completed',
            rewardTokens: 100,
            ...data
        }),
        get: vi.fn().mockResolvedValue({
            exists: true,
            id,
            data: () => ({
                uid: id,
                username: 'testuser',
                tokens: 1000,
                status: 'completed',
                rewardTokens: 100,
                ...data
            })
        }),
        update: vi.fn().mockResolvedValue(true),
        set: vi.fn().mockResolvedValue(true),
    });

    const mockCollectionSingleton = (name) => ({
        doc: vi.fn().mockImplementation((id) => makeMockDoc(id, {}, name)),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
            empty: true,
            docs: [],
            forEach: vi.fn()
        }),
        add: vi.fn().mockResolvedValue({ id: 'new-txn-id' })
    });

    const mockFirestoreSingleton = {
        collection: vi.fn().mockImplementation((name) => mockCollectionSingleton(name)),
        doc: vi.fn().mockImplementation((id) => makeMockDoc(id)),
        runTransaction: vi.fn().mockImplementation(async (cb) => {
            return cb({
                get: vi.fn().mockImplementation((ref) => ref.get ? ref.get() : makeMockDoc()),
                update: vi.fn(),
                set: vi.fn(),
            });
        }),
    };

    const mockRtdb = {
        ref: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
            exists: () => true,
            val: () => ({})
        }),
    };

    const FieldValue = {
        serverTimestamp: () => 'mock-timestamp',
        increment: (val) => ({ _increment: val })
    };

    const firestoreMock = vi.fn(() => mockFirestoreSingleton);
    firestoreMock.FieldValue = FieldValue;

    return {
        admin: {
            auth: () => mockAuthSingleton,
            firestore: firestoreMock,
            database: () => mockRtdb
        },
        initializeFirebase: vi.fn(),
        getFirestore: () => mockFirestoreSingleton,
        getRealtimeDb: () => mockRtdb
    };
});

import { app } from '../src/index.js';
import { admin, getFirestore } from '../src/services/firebase.js';

const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
};

const getAuthHeader = (token = 'valid-token') => {
    return { Authorization: `Bearer ${token}` };
};

describe('Quests API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        admin.auth().verifyIdToken.mockResolvedValue(mockUser);
    });

    describe('GET /api/quests/:playerId', () => {
        it('should return player quests', async () => {
            const mockQuestDoc = {
                id: 'quest-1',
                data: () => ({ name: 'Daily Quest', status: 'available' })
            };
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
        });
    });

    describe('POST /api/quests/:playerId/claim/:questId', () => {
        it('should claim quest reward successfully', async () => {
            // Setup explicit success mock
            const questId = 'streak_master';
            const mockProgressData = {
                quests: {
                    [questId]: {
                        progress: 3,
                        completed: true,
                        claimed: false,
                        lastUpdated: { toDate: () => new Date() }
                    }
                }
            };

            // Mock transaction.get for player and progress
            const mockPlayerDoc = { exists: true, data: () => ({ tokens: 100 }) };
            const mockProgressDoc = { exists: true, data: () => mockProgressData };

            getFirestore().runTransaction.mockImplementation(async (callback) => {
                return callback({
                    get: vi.fn().mockImplementation((ref) => {
                        if (ref.path.includes('players')) return Promise.resolve(mockPlayerDoc);
                        if (ref.path.includes('questProgress')) return Promise.resolve(mockProgressDoc);
                        return Promise.resolve({ exists: false });
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
            expect(response.body.reward).toBe(100); // Reward for streak_master
        });

        // XSS Security Test for questId
        it('should handle questId with script tags (XSS attempt)', async () => {
            const response = await request(app)
                .post(`/api/quests/${mockUser.uid}/claim/<script>alert("xss")</script>`)
                .set(getAuthHeader());

            // Should be 404 (Quest not found) or 400 (Validation)
            expect([400, 404]).toContain(response.status);
            // If it returns an error with the questId, ensure it's not echoing the script raw if the content-type was HTML (unlikely here but good validation)
            if (response.body.error) {
                expect(response.body.error).not.toContain('<script>');
            }
        });

        it('should return 404 for unknown quest', async () => {
            getFirestore().collection('playerQuests').doc('unknown').get.mockResolvedValueOnce({
                exists: false
            });

            const response = await request(app)
                .post(`/api/quests/${mockUser.uid}/claim/unknown`)
                .set(getAuthHeader());

            expect(response.status).toBe(404);
        });
    });
});
