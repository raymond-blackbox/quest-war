import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock Firebase BEFORE importing app or routes
vi.mock('../src/services/firebase.js', () => {
    const mockAuthSingleton = {
        verifyIdToken: vi.fn(),
    };

    const makeMockDoc = (id = 'test-id', data = {}) => ({
        exists: true,
        id,
        data: vi.fn().mockReturnValue({
            uid: id,
            username: 'testuser',
            tokens: 1000,
            ...data
        }),
    });

    const mockCollectionSingleton = {
        doc: vi.fn().mockImplementation((id) => makeMockDoc(id)),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
            empty: true,
            docs: [],
            forEach: vi.fn()
        }),
    };

    const mockFirestoreSingleton = {
        collection: vi.fn().mockReturnValue(mockCollectionSingleton),
    };

    return {
        admin: {
            auth: () => mockAuthSingleton,
            firestore: {
                FieldValue: {
                    serverTimestamp: () => 'mock-timestamp'
                }
            },
        },
        initializeFirebase: vi.fn(),
        getFirestore: () => mockFirestoreSingleton,
        getRealtimeDb: vi.fn()
    };
});

import { app } from '../src/index.js';
import { admin, getFirestore } from '../src/services/firebase.js';

describe('Leaderboard API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/leaderboard', () => {
        it('should return leaderboard data', async () => {
            const mockPlayerDoc = {
                id: 'player-1',
                data: () => ({ username: 'topdog', tokens: 5000 })
            };
            getFirestore().collection('players').get.mockResolvedValueOnce({
                empty: false,
                docs: [mockPlayerDoc],
                forEach: (cb) => cb(mockPlayerDoc)
            });

            const response = await request(app).get('/api/leaderboard');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1);
            expect(response.body[0].username).toBe('topdog');
        });

        it('should filter by category', async () => {
            const response = await request(app).get('/api/leaderboard?category=tokens');
            expect(response.status).toBe(200);
            expect(getFirestore().collection('players').orderBy).toHaveBeenCalledWith('tokens', 'desc');
        });
    });
});
