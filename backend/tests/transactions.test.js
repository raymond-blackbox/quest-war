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
            type: 'TOKEN_PURCHASE',
            amount: 500,
            timestamp: Date.now(),
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

const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
};

const getAuthHeader = (token = 'valid-token') => {
    return { Authorization: `Bearer ${token}` };
};

describe('Transactions API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        admin.auth().verifyIdToken.mockResolvedValue(mockUser);
    });

    describe('GET /api/transactions/:playerId', () => {
        it('should return player transactions with pagination metadata', async () => {
            const mockTransDoc = {
                id: 'trans-1',
                data: () => ({ type: 'REWARD', amount: 100, createdAt: { toDate: () => new Date() } })
            };

            const mockQuery = {
                where: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                count: vi.fn().mockReturnValue({
                    get: vi.fn().mockResolvedValue({
                        data: () => ({ count: 1 })
                    })
                }),
                get: vi.fn().mockResolvedValue({
                    empty: false,
                    docs: [mockTransDoc]
                })
            };

            getFirestore().collection.mockReturnValue(mockQuery);

            const response = await request(app)
                .get(`/api/transactions/${mockUser.uid}`)
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('pagination');
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBe(1);
            expect(response.body.pagination.total).toBe(1);
        });


        it('should return 403 if accessing other player transactions', async () => {
            const response = await request(app)
                .get('/api/transactions/other-player')
                .set(getAuthHeader());

            expect(response.status).toBe(403);
        });
    });
});
