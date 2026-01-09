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
        it('should return player transactions', async () => {
            const mockTransDoc = {
                id: 'trans-1',
                data: () => ({ type: 'REWARD', amount: 100, timestamp: { toDate: () => new Date() } })
            };
            getFirestore().collection('transactions').get.mockResolvedValueOnce({
                empty: false,
                docs: [mockTransDoc],
                forEach: (cb) => cb(mockTransDoc)
            });

            const response = await request(app)
                .get(`/api/transactions/${mockUser.uid}`)
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('transactions');
            expect(Array.isArray(response.body.transactions)).toBe(true);
            expect(response.body.transactions.length).toBe(1);
        });

        it('should return 403 if accessing other player transactions', async () => {
            const response = await request(app)
                .get('/api/transactions/other-player')
                .set(getAuthHeader());

            expect(response.status).toBe(403);
        });
    });
});
