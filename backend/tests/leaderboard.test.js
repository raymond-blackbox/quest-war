import { describe, it, expect, vi, beforeEach } from 'vitest';
import './testSetup.js';
import request from 'supertest';
import { app } from '../src/index.js';
import { getFirestore } from '../src/services/firebase.js';

describe('Leaderboard API', () => {
    let mockCollection;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCollection = getFirestore().collection('leaderboard');
        getFirestore().collection.mockReturnValue(mockCollection);
    });

    describe('GET /api/leaderboard', () => {
        it('should return leaderboard data correctly', async () => {
            const mockPlayerDoc = {
                id: 'player-1',
                data: () => ({ username: 'topdog', tokens: 5000 })
            };

            mockCollection.get.mockResolvedValueOnce({
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

        it('should filter by earnings category', async () => {
            mockCollection.get.mockResolvedValueOnce({
                empty: true,
                docs: [],
                forEach: vi.fn()
            });

            const response = await request(app).get('/api/leaderboard?category=earnings');
            expect(response.status).toBe(200);
            expect(mockCollection.orderBy).toHaveBeenCalledWith('totalTokensEarned', 'desc');
        });

        it('should default to balance category for invalid category', async () => {
            mockCollection.get.mockResolvedValueOnce({
                empty: true,
                docs: [],
                forEach: vi.fn()
            });

            const response = await request(app).get('/api/leaderboard?category=invalid');
            expect(response.status).toBe(200);
            expect(mockCollection.orderBy).toHaveBeenCalledWith('tokens', 'desc');
        });

        it('should return empty array when no scores exist', async () => {
            mockCollection.get.mockResolvedValueOnce({
                empty: true,
                docs: [],
                forEach: vi.fn()
            });

            const response = await request(app).get('/api/leaderboard');

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });
    });
});
