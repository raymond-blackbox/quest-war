import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock Question Providers to avoid real dependency issues
vi.mock('../src/services/questionProviders/index.js', () => {
    const mockProvider = {
        generateQuestion: vi.fn(),
        DIFFICULTY: { EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' }
    };
    return {
        getQuestionProvider: vi.fn().mockReturnValue(mockProvider),
        GAME_TYPES: { MATH: 'math', SCIENCE: 'science' }
    };
});

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
        get: vi.fn().mockResolvedValue({
            exists: true,
            id,
            data: () => ({
                uid: id,
                username: 'testuser',
                tokens: 1000,
                ...data
            })
        }),
        update: vi.fn().mockResolvedValue(true),
        set: vi.fn().mockResolvedValue(true),
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
        add: vi.fn().mockResolvedValue({ id: 'new-doc-id' })
    };

    class MockFirestore {
        constructor() {
            this.collection = vi.fn().mockReturnValue(mockCollectionSingleton);
            this.doc = vi.fn().mockImplementation((id) => makeMockDoc(id));
            this.runTransaction = vi.fn().mockImplementation(async (cb) => {
                return cb({
                    get: vi.fn().mockImplementation((ref) => ref.get ? ref.get() : makeMockDoc()),
                    update: vi.fn(),
                    set: vi.fn(),
                });
            });
        }
        static FieldValue = {
            serverTimestamp: () => 'mock-timestamp',
            increment: (val) => ({ _increment: val })
        }
    }

    const mockFirestoreInstance = new MockFirestore();

    const makeSnapshot = (data = {}) => ({
        exists: () => data !== null,
        val: () => data,
        key: 'mock-key',
    });

    const mockRtdbSingleton = {
        ref: vi.fn().mockReturnThis(),
        orderByChild: vi.fn().mockReturnThis(),
        equalTo: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(makeSnapshot({ status: 'waiting', hostId: 'test-user-id' })),
        update: vi.fn().mockResolvedValue(true),
        set: vi.fn().mockResolvedValue(true),
        on: vi.fn(),
        off: vi.fn(),
        remove: vi.fn(),
        child: vi.fn().mockReturnThis(),
        push: vi.fn().mockReturnValue({ key: 'new-key', set: vi.fn().mockResolvedValue(true) }),
    };

    const FieldValue = {
        serverTimestamp: () => 'mock-timestamp',
        increment: (val) => ({ _increment: val })
    };

    const firestoreMock = vi.fn(() => mockFirestoreInstance);
    firestoreMock.FieldValue = FieldValue;

    return {
        admin: {
            auth: () => mockAuthSingleton,
            firestore: firestoreMock,
            database: () => mockRtdbSingleton
        },
        initializeFirebase: vi.fn(),
        getFirestore: () => mockFirestoreInstance,
        getRealtimeDb: () => mockRtdbSingleton
    };
});

import { app } from '../src/index.js';
import { admin, getRealtimeDb } from '../src/services/firebase.js';

const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
};

const getAuthHeader = (token = 'valid-token') => {
    return { Authorization: `Bearer ${token}` };
};

describe('Game API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        admin.auth().verifyIdToken.mockResolvedValue(mockUser);
    });

    describe('POST /api/game/:roomId/start', () => {
        it('should start a solo game successfully', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    status: 'waiting',
                    isSolo: true,
                    hostId: mockUser.uid,
                    settings: { questionsCount: 10 },
                    players: { [mockUser.uid]: { ready: true } }
                }),
                key: 'room-1'
            });

            const response = await request(app)
                .post('/api/game/room-1/start')
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/game/:roomId/answer', () => {
        it('should submit an answer', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    status: 'playing',
                    isSolo: true,
                    currentQuestion: { id: 'q-1', answerIndex: 0, correctIndex: 0 },
                    players: { [mockUser.uid]: { score: 0 } }
                }),
                key: 'room-1'
            });

            const response = await request(app)
                .post('/api/game/room-1/answer')
                .set(getAuthHeader())
                .send({ answerIndex: 0, playerUsername: 'testuser' });

            expect(response.status).toBe(200);
            expect(response.body.correct).toBe(true);
            expect(response.body.correctIndex).toBe(0);
        });

        // XSS Security Test for playerUsername
        it('should handle playerUsername with script tags (XSS attempt)', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    status: 'playing',
                    isSolo: true,
                    currentQuestion: { id: 'q-1', answerIndex: 0, correctIndex: 0 },
                    players: { [mockUser.uid]: { score: 0 } }
                }),
                key: 'room-1'
            });

            const response = await request(app)
                .post('/api/game/room-1/answer')
                .set(getAuthHeader())
                .send({
                    answerIndex: 0,
                    playerUsername: '<script>alert("xss")</script>'
                });

            // The endpoint might accept it (200), but we check it doesn't crash or return the script raw in a sensitive way.
            // Since this API typically returns { correct: bool }, the input might not be reflected directly in this response.
            // But good to ensure 200/400 and no 500.
            expect([200, 400]).toContain(response.status);
        });
    });

    describe('POST /api/game/:roomId/quit', () => {
        it('should quit game successfully', async () => {
            getRealtimeDb().ref().get.mockResolvedValue({
                exists: () => true,
                val: () => ({
                    status: 'playing',
                    players: { [mockUser.uid]: { username: 'testuser' } }
                }),
                key: 'room-1'
            });

            const response = await request(app)
                .post('/api/game/room-1/quit')
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });
});
