import { describe, it, expect, vi, beforeEach } from 'vitest';
import './testSetup.js';
import request from 'supertest';
import { app } from '../src/index.js';
import { admin, getFirestore } from '../src/services/firebase.js';
import { getAuthHeader, mockUser } from './testSetup.js';
import userRepository from '../src/repositories/user.repository.js';

vi.mock('../src/repositories/user.repository.js', async () => {
    const actual = await vi.importActual('../src/repositories/user.repository.js');
    return {
        ...actual,
        default: {
            findById: vi.fn(),
            findByField: vi.fn(),
            runTransaction: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            toPlayerResponse: vi.fn()
        }
    };
});

describe('Auth API', () => {
    const otherPlayerId = 'other-player-id';

    beforeEach(() => {
        vi.clearAllMocks();
        admin.auth().verifyIdToken.mockResolvedValue(mockUser);

        // Base mock for getProfile
        userRepository.findById.mockResolvedValue({ id: mockUser.uid, ...mockUser, tokens: 1000 });
        userRepository.findByField.mockResolvedValue(null);
    });

    describe('POST /api/auth/firebase', () => {
        it('should login successfully with valid token', async () => {
            const newUser = { id: mockUser.uid, ...mockUser, tokens: 0 };
            userRepository.findById.mockResolvedValueOnce(null); // New user
            userRepository.create.mockResolvedValueOnce(newUser); // Return new user on create

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
            const updatedProfile = { id: mockUser.uid, ...mockUser, displayName: 'NewName', tokens: 500 };

            userRepository.runTransaction.mockImplementationOnce(async (callback) => {
                return callback({
                    get: vi.fn().mockResolvedValue({
                        exists: true,
                        id: mockUser.uid,
                        data: () => ({ ...mockUser, tokens: 1000 })
                    }),
                    update: vi.fn(),
                    set: vi.fn()
                });
            });

            const response = await request(app)
                .patch(`/api/auth/profile/${mockUser.uid}`)
                .set(getAuthHeader())
                .send({ displayName: 'NewName' });

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(mockUser.uid);
            expect(response.body.displayName).toBe('NewName');
        });

        it('should return 403 if user attempts to update another player\'s profile', async () => {
            const response = await request(app)
                .patch(`/api/auth/profile/${otherPlayerId}`)
                .set(getAuthHeader())
                .send({ displayName: 'HackerName' });

            expect(response.status).toBe(403);
            expect(response.body.error).toContain('own profile');
        });

        it('should return 402 if tokens are insufficient', async () => {
            userRepository.runTransaction.mockImplementationOnce(async (callback) => {
                return callback({
                    get: vi.fn().mockResolvedValue({
                        exists: true,
                        id: mockUser.uid,
                        data: () => ({ ...mockUser, tokens: 100 })
                    }),
                    update: vi.fn(),
                    set: vi.fn()
                });
            });

            const response = await request(app)
                .patch(`/api/auth/profile/${mockUser.uid}`)
                .set(getAuthHeader())
                .send({ displayName: 'RichName' });

            expect(response.status).toBe(402);
            expect(response.body.error).toContain('Insufficient');
        });

        it('should return 400 if displayName is invalid', async () => {
            const response = await request(app)
                .patch(`/api/auth/profile/${mockUser.uid}`)
                .set(getAuthHeader())
                .send({ displayName: 'Ab' }); // Too short (min 3)

            expect(response.status).toBe(400);
        });

        it('should reject XSS payloads in updates via validation', async () => {
            const xssPayload = '<script>alert(1)</script>';
            const response = await request(app)
                .patch(`/api/auth/profile/${mockUser.uid}`)
                .set(getAuthHeader())
                .send({ displayName: xssPayload });

            expect(response.status).toBe(400);
        });
    });
});
