import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock Firebase BEFORE importing app or routes
vi.mock('../src/services/firebase.js', () => {
    const mockAuthSingleton = {
        verifyIdToken: vi.fn(),
        createCustomToken: vi.fn().mockResolvedValue('mock-custom-token'),
    };

    const makeMockDoc = (id = 'test-id', data = {}) => ({
        exists: true,
        id,
        data: vi.fn().mockReturnValue({
            uid: id,
            username: 'testuser',
            displayName: 'Test User',
            tokens: 1000,
            ...data
        }),
        get: vi.fn().mockResolvedValue({
            exists: true,
            id,
            data: () => ({
                uid: id,
                username: 'testuser',
                displayName: 'Test User',
                tokens: 1000,
                ...data
            })
        }),
        update: vi.fn().mockResolvedValue(true),
        set: vi.fn().mockResolvedValue(true),
    });

    const mockCollection = {
        doc: vi.fn().mockImplementation((id) => makeMockDoc(id)),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        startAfter: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
            empty: true,
            docs: [],
            forEach: vi.fn()
        }),
        add: vi.fn().mockResolvedValue({ id: 'new-doc-id' })
    };

    const mockFirestore = {
        collection: vi.fn().mockReturnValue(mockCollection),
        doc: vi.fn().mockImplementation((id) => makeMockDoc(id)),
        runTransaction: vi.fn().mockImplementation(async (cb) => {
            return cb({
                get: vi.fn().mockImplementation((ref) => ref.get()),
                update: vi.fn(),
                set: vi.fn(),
                delete: vi.fn()
            });
        }),
        constructor: {
            FieldValue: {
                serverTimestamp: () => 'mock-timestamp'
            }
        }
    };

    const mockRtdb = {
        ref: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
            exists: () => true,
            val: () => ({})
        }),
        update: vi.fn().mockResolvedValue(true),
        set: vi.fn().mockResolvedValue(true),
        push: vi.fn().mockReturnThis(),
        key: 'mock-key',
        child: vi.fn().mockReturnThis(),
        transaction: vi.fn().mockImplementation((fn) => {
            const result = fn(0);
            return Promise.resolve({ committed: true, snapshot: { val: () => result } });
        }),
        on: vi.fn(),
        off: vi.fn(),
        remove: vi.fn(),
    };

    return {
        admin: {
            auth: () => mockAuthSingleton,
            firestore: {
                FieldValue: {
                    serverTimestamp: () => 'mock-timestamp'
                }
            },
            database: () => mockRtdb
        },
        initializeFirebase: vi.fn(),
        getFirestore: () => mockFirestore,
        getRealtimeDb: () => mockRtdb
    };
});

import { app } from '../src/index.js';
import { admin } from '../src/services/firebase.js';

const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User'
};

const getAuthHeader = (token = 'valid-token') => {
    return { Authorization: `Bearer ${token}` };
};

describe('Auth API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Access the singleton mock through the imported admin
        admin.auth().verifyIdToken.mockResolvedValue(mockUser);
    });

    describe('POST /api/auth/firebase', () => {
        it('should login successfully with valid token', async () => {
            const response = await request(app)
                .post('/api/auth/firebase')
                .send({ idToken: 'valid-token' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('id');
            expect(response.body.id).toBe(mockUser.uid);
        });

        it('should return 400 if idToken is missing', async () => {
            const response = await request(app)
                .post('/api/auth/firebase')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/auth/profile/:playerId', () => {
        it('should return profile for authorized user', async () => {
            const response = await request(app)
                .get(`/api/auth/profile/${mockUser.uid}`)
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(mockUser.uid);
        });

        it('should return 401 if unauthorized', async () => {
            admin.auth().verifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));
            const response = await request(app)
                .get(`/api/auth/profile/${mockUser.uid}`)
                .set(getAuthHeader('invalid-token'));

            expect(response.status).toBe(401);
        });
    });

    describe('PATCH /api/auth/profile/:playerId', () => {
        it('should update profile successfully', async () => {
            const response = await request(app)
                .patch(`/api/auth/profile/${mockUser.uid}`)
                .set(getAuthHeader())
                .send({ displayName: 'NewName' });

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(mockUser.uid);
        });

        it('should return 400 if displayName is invalid', async () => {
            const response = await request(app)
                .patch(`/api/auth/profile/${mockUser.uid}`)
                .set(getAuthHeader())
                .send({ displayName: 'Ab' }); // Too short (min 3)

            expect(response.status).toBe(400);
        });

        // XSS Security Tests
        it('should reject displayName with script tags (XSS attempt)', async () => {
            const response = await request(app)
                .patch(`/api/auth/profile/${mockUser.uid}`)
                .set(getAuthHeader())
                .send({ displayName: '<script>alert("xss")</script>' });

            // Should either be rejected (400) or sanitized (200 with cleaned content)
            expect([200, 400]).toContain(response.status);
            if (response.status === 200) {
                // If accepted, ensure no script tags in the response
                expect(response.body.displayName).not.toContain('<script>');
            }
        });

        it('should reject displayName with event handler (XSS attempt)', async () => {
            const response = await request(app)
                .patch(`/api/auth/profile/${mockUser.uid}`)
                .set(getAuthHeader())
                .send({ displayName: 'test<img onerror="alert(1)" src=x>' });

            expect([200, 400]).toContain(response.status);
            if (response.status === 200) {
                expect(response.body.displayName).not.toContain('onerror');
            }
        });
    });
});
