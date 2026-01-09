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

    const mockFirestoreSingleton = {
        collection: vi.fn().mockReturnValue(mockCollectionSingleton),
        doc: vi.fn().mockImplementation((id) => makeMockDoc(id)),
        runTransaction: vi.fn().mockImplementation(async (cb) => {
            return cb({
                get: vi.fn().mockImplementation((ref) => ref.get ? ref.get() : makeMockDoc()),
                update: vi.fn(),
                set: vi.fn(),
            });
        }),
    };

    const mockRtdbSingleton = {
        ref: vi.fn().mockReturnThis(),
        orderByChild: vi.fn().mockReturnThis(),
        equalTo: vi.fn().mockReturnThis(),
        push: vi.fn().mockReturnValue({ key: 'new-room-id', set: vi.fn().mockResolvedValue(true) }),
        get: vi.fn().mockResolvedValue({
            exists: () => false,
            val: () => null,
            forEach: vi.fn()
        }),
        update: vi.fn().mockResolvedValue(true),
        set: vi.fn().mockResolvedValue(true),
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
            database: () => mockRtdbSingleton
        },
        initializeFirebase: vi.fn(),
        getFirestore: () => mockFirestoreSingleton,
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

describe('Rooms API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        admin.auth().verifyIdToken.mockResolvedValue(mockUser);
    });

    describe('GET /api/rooms', () => {
        it('should list available rooms', async () => {
            const mockRooms = {
                'room-1': {
                    name: 'Test Room',
                    status: 'waiting',
                    hostId: 'host-1',
                    players: {
                        'host-1': { username: 'hostuser', displayName: 'Host' }
                    }
                }
            };

            const makeSnapshot = (data) => ({
                exists: () => true,
                val: () => data,
                forEach: (cb) => {
                    Object.entries(data).forEach(([key, val]) => {
                        cb({ key, val: () => val });
                    });
                }
            });

            getRealtimeDb().ref().get.mockResolvedValueOnce(makeSnapshot(mockRooms));

            const response = await request(app)
                .get('/api/rooms')
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1);
            expect(response.body[0].id).toBe('room-1');
        });
    });

    describe('POST /api/rooms', () => {
        it('should create a new room', async () => {
            const response = await request(app)
                .post('/api/rooms')
                .set(getAuthHeader())
                .send({ name: 'New Room' });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('roomId');
        });

        // XSS Security Tests
        it('should handle room name with script tags (XSS attempt)', async () => {
            const response = await request(app)
                .post('/api/rooms')
                .set(getAuthHeader())
                .send({ name: '<script>alert("xss")</script>' });

            // Should either be rejected (400) or sanitized/accepted (201)
            expect([201, 400]).toContain(response.status);
            if (response.status === 201) {
                // If accepted, the malicious content shouldn't affect server operation
                expect(response.body).toHaveProperty('roomId');
            }
        });

        it('should handle room name with event handler (XSS attempt)', async () => {
            const response = await request(app)
                .post('/api/rooms')
                .set(getAuthHeader())
                .send({ name: 'room<img onerror="alert(1)" src=x>' });

            expect([201, 400]).toContain(response.status);
        });

        it('should handle settings fields (dropdowns) with script tags (XSS attempt)', async () => {
            const response = await request(app)
                .post('/api/rooms')
                .set(getAuthHeader())
                .send({
                    name: 'Safe Room',
                    gameType: '<script>alert("xss")</script>', // Dropdown field
                    questionDifficulty: 'easy"><script>alert(1)</script>' // Dropdown field
                });

            expect([201, 400]).toContain(response.status);
        });
    });

    describe('POST /api/rooms/:id/join', () => {
        it('should join a room', async () => {
            getRealtimeDb().ref().get.mockResolvedValueOnce({
                exists: () => true,
                val: () => ({
                    name: 'Test Room',
                    status: 'waiting',
                    players: {},
                    hostId: 'host-1'
                })
            });

            const response = await request(app)
                .post('/api/rooms/room-1/join')
                .set(getAuthHeader())
                .send({ playerUsername: 'newplayer' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('Bug Fix Verification', () => {
        it('should persist room details (difficulty, gameType, questionsCount)', async () => {
            const roomData = {
                name: 'Detail Room',
                gameType: 'science',
                questionDifficulty: 'hard',
                questionsCount: 20
            };

            const response = await request(app)
                .post('/api/rooms')
                .set(getAuthHeader())
                .send(roomData);

            expect(response.status).toBe(201);

            const mockPush = getRealtimeDb().ref().push;
            const mockSet = mockPush().set;
            const savedData = mockSet.mock.calls[0][0];

            expect(savedData).toMatchObject({
                name: roomData.name,
                settings: {
                    gameType: roomData.gameType,
                    questionDifficulty: roomData.questionDifficulty,
                    questionsCount: roomData.questionsCount
                }
            });
        });

        it('should persist host display name', async () => {
            const roomData = {
                name: 'Host Name Room',
                hostDisplayName: 'SuperHost'
            };

            const response = await request(app)
                .post('/api/rooms')
                .set(getAuthHeader())
                .send(roomData);

            expect(response.status).toBe(201);

            const mockSet = getRealtimeDb().ref().push().set;
            const savedData = mockSet.mock.calls[0][0];

            expect(savedData.players['test-user-id']).toMatchObject({
                displayName: 'SuperHost'
            });
        });

        it('should persist joiner display name', async () => {
            // Setup specific mock for this test
            const mockUpdate = vi.fn().mockResolvedValue(true);

            // We need to inject this mock into the getRealtimeDb() return chain
            // The cleanest way in this specific file structure is to spy on the ref() call 
            // but we need to match the specific implementation used in the test file's mock factory

            // Re-using the getRealtimeDb definition from the top level mock might be tricky 
            // because `vi.mock` is hoisted. 
            // Instead, we can rely on the fact that `getRealtimeDb()` returns the singleton 
            // used by the code. We can modify its behavior for this test.

            const db = getRealtimeDb();
            const originalRef = db.ref;

            db.ref = vi.fn().mockImplementation((path) => {
                if (path === 'rooms/room-1/players/test-user-id') {
                    return {
                        update: mockUpdate,
                        get: vi.fn().mockResolvedValue({
                            exists: () => true,
                            key: 'test-user-id',
                            val: () => ({ username: 'joiner', displayName: 'TopPlayer' })
                        }),
                        remove: vi.fn()
                    };
                }
                if (path === 'rooms/room-1') {
                    return {
                        get: vi.fn().mockResolvedValue({
                            exists: () => true,
                            key: 'room-1',
                            val: () => ({
                                name: 'Test Room',
                                status: 'waiting',
                                players: {},
                                hostId: 'host-1',
                                isSolo: false
                            })
                        })
                    }
                }
                return originalRef(path); // Fallback to original mock behavior
            });

            const joinData = {
                playerUsername: 'joiner',
                playerDisplayName: 'TopPlayer'
            };

            const response = await request(app)
                .post('/api/rooms/room-1/join')
                .set(getAuthHeader())
                .send(joinData);

            // Restore original mock
            db.ref = originalRef;

            expect(response.status).toBe(200);
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                displayName: 'TopPlayer',
                username: 'joiner'
            }));
        });

        it('should persist game timing settings (delaySeconds, roundSeconds)', async () => {
            const roomData = {
                name: 'Timing Room',
                delaySeconds: 3,
                roundSeconds: 15
            };

            const response = await request(app)
                .post('/api/rooms')
                .set(getAuthHeader())
                .send(roomData);

            expect(response.status).toBe(201);

            const mockSet = getRealtimeDb().ref().push().set;
            const savedData = mockSet.mock.calls[0][0];

            expect(savedData.settings).toMatchObject({
                delaySeconds: 3,
                roundSeconds: 15
            });
        });
    });
});
