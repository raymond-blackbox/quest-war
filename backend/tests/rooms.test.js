import { describe, it, expect, vi, beforeEach } from 'vitest';
import './testSetup.js';
import request from 'supertest';
import { app } from '../src/index.js';
import { admin, getRealtimeDb } from '../src/services/firebase.js';
import { getAuthHeader, mockUser } from './testSetup.js';

describe('Rooms API', () => {
    const roomId = 'room-123';

    beforeEach(() => {
        vi.clearAllMocks();
        admin.auth().verifyIdToken.mockResolvedValue(mockUser);
    });

    const makeSnapshot = (data, key = roomId) => ({
        exists: () => !!data,
        val: () => data,
        key,
        forEach: (cb) => {
            if (data) {
                Object.entries(data).forEach(([k, v]) => {
                    cb({ key: k, val: () => v });
                });
            }
        }
    });

    describe('Authentication', () => {
        it('should return 401 if no auth header is provided', async () => {
            const endpoints = [
                { method: 'get', path: '/api/rooms' },
                { method: 'post', path: '/api/rooms' },
                { method: 'post', path: `/api/rooms/${roomId}/join` },
                { method: 'post', path: `/api/rooms/${roomId}/ready` },
                { method: 'post', path: `/api/rooms/${roomId}/leave` },
            ];

            for (const { method, path } of endpoints) {
                const response = await request(app)[method](path);
                expect(response.status).toBe(401);
            }
        });
    });

    describe('GET /api/rooms', () => {
        it('should list available rooms', async () => {
            const mockRooms = {
                [roomId]: {
                    name: 'Test Room',
                    status: 'waiting',
                    hostId: 'host-1',
                    players: {
                        'host-1': { username: 'hostuser', displayName: 'Host' }
                    }
                }
            };

            getRealtimeDb().ref().get.mockResolvedValueOnce(makeSnapshot(mockRooms));

            const response = await request(app)
                .get('/api/rooms')
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body[0].id).toBe(roomId);
            expect(response.body[0].hostUsername).toBe('Host');
        });
    });

    describe('POST /api/rooms', () => {
        it('should create a new public room successfully', async () => {
            const roomData = {
                name: 'Public Room',
                hostUsername: 'hostuser'
            };

            const response = await request(app)
                .post('/api/rooms')
                .set(getAuthHeader())
                .send(roomData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('roomId');

            // Verify RTDB call
            expect(getRealtimeDb().ref().push).toHaveBeenCalled();
            expect(getRealtimeDb().ref().push().set).toHaveBeenCalledWith(expect.objectContaining({
                name: roomData.name,
                status: 'waiting',
                isPrivate: false
            }));
        });

        it('should create a solo room', async () => {
            const roomData = {
                name: 'Solo Room',
                isSolo: true,
                hostUsername: 'hostuser'
            };

            const response = await request(app)
                .post('/api/rooms')
                .set(getAuthHeader())
                .send(roomData);

            expect(response.status).toBe(201);
            // Solo room host should be auto-ready
            const savedData = getRealtimeDb().ref().push().set.mock.calls[0][0];
            expect(savedData.players[mockUser.uid].ready).toBe(true);
        });

        it('should reject room creation with XSS payload (400)', async () => {
            const response = await request(app)
                .post('/api/rooms')
                .set(getAuthHeader())
                .send({ name: '<script>alert(1)</script>' });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Validation');
        });

        it('should return 400 for missing name', async () => {
            const response = await request(app)
                .post('/api/rooms')
                .set(getAuthHeader())
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/rooms/:id/join', () => {
        it('should return 404 if room does not exist', async () => {
            getRealtimeDb().ref().get.mockResolvedValueOnce(makeSnapshot(null));

            const response = await request(app)
                .post(`/api/rooms/invalid/join`)
                .set(getAuthHeader())
                .send({ playerUsername: 'joiner' });

            expect(response.status).toBe(404);
        });

        it('should return 400 if game is already in progress', async () => {
            getRealtimeDb().ref().get.mockResolvedValueOnce(makeSnapshot({ status: 'playing' }));

            const response = await request(app)
                .post(`/api/rooms/${roomId}/join`)
                .set(getAuthHeader())
                .send({ playerUsername: 'joiner' });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('in progress');
        });

        it('should return 409 if room is full', async () => {
            getRealtimeDb().ref().get.mockResolvedValueOnce(makeSnapshot({
                status: 'waiting',
                players: { 'p1': {}, 'p2': {}, 'p3': {}, 'p4': {}, 'p5': {} }
            }));

            const response = await request(app)
                .post(`/api/rooms/${roomId}/join`)
                .set(getAuthHeader())
                .send({ playerUsername: 'joiner' });

            expect(response.status).toBe(409);
        });

        it('should join successfully and update RTDB', async () => {
            getRealtimeDb().ref().get.mockResolvedValueOnce(makeSnapshot({ status: 'waiting', players: {} }));

            const response = await request(app)
                .post(`/api/rooms/${roomId}/join`)
                .set(getAuthHeader())
                .send({ playerUsername: 'joiner', playerDisplayName: 'Top G' });

            expect(response.status).toBe(200);
            expect(getRealtimeDb().ref).toHaveBeenCalledWith(expect.stringContaining(`players/${mockUser.uid}`));
            expect(getRealtimeDb().ref().update).toHaveBeenCalledWith(expect.objectContaining({
                username: 'joiner',
                displayName: 'Top G'
            }));
        });
    });

    describe('POST /api/rooms/:id/ready', () => {
        it('should toggle ready status', async () => {
            getRealtimeDb().ref().get.mockResolvedValueOnce(makeSnapshot({}));

            const response = await request(app)
                .post(`/api/rooms/${roomId}/ready`)
                .set(getAuthHeader())
                .send({ ready: true });

            expect(response.status).toBe(200);
            expect(getRealtimeDb().ref().update).toHaveBeenCalledWith({ ready: true });
        });
    });

    describe('POST /api/rooms/:id/leave', () => {
        it('should dismiss room if host leaves waiting room', async () => {
            getRealtimeDb().ref().get.mockResolvedValueOnce(makeSnapshot({ status: 'waiting', hostId: mockUser.uid }));

            const response = await request(app)
                .post(`/api/rooms/${roomId}/leave`)
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(response.body.roomDismissed).toBe(true);
            expect(getRealtimeDb().ref().remove).toHaveBeenCalled();
        });

        it('should just remove player if non-host leaves', async () => {
            const initialRoom = {
                status: 'waiting',
                hostId: 'other-host',
                players: { [mockUser.uid]: {}, 'other-host': {} }
            };
            const updatedRoom = { players: { 'other-host': {} } };

            getRealtimeDb().ref().get
                .mockResolvedValueOnce(makeSnapshot(initialRoom))
                .mockResolvedValueOnce(makeSnapshot(updatedRoom));

            const response = await request(app)
                .post(`/api/rooms/${roomId}/leave`)
                .set(getAuthHeader());

            expect(response.status).toBe(200);
            expect(getRealtimeDb().ref().remove).toHaveBeenCalled();
            // Verify it didn't remove the whole room (which would be called with roomId)
            // But verify it DID remove the player
            expect(getRealtimeDb().ref).toHaveBeenCalledWith(expect.stringContaining(`players/${mockUser.uid}`));
        });
    });
});
