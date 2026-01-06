import logger from '../utils/logger';

const API_BASE = '/api';

class ApiService {
    constructor() {
        this.token = null;
    }

    setToken(token) {
        this.token = token;
    }

    async request(endpoint, options = {}) {
        logger.info(`[API] Starting request to ${endpoint}`, { method: options.method || 'GET' });
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            const authHeader = `Bearer ${this.token}`;
            headers['Authorization'] = authHeader;
            logger.info('[API] Token attached. Header length:', authHeader.length);
        } else {
            logger.warn('[API] No token available for request to', endpoint);
        }

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });
            logger.info(`[API] Response received from ${endpoint}: ${response.status}`);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Request failed' }));
                logger.error(`[API] Request failed for ${endpoint}:`, error);
                throw new Error(error.message || error.error || 'Request failed');
            }

            return response.json();
        } catch (err) {
            logger.error(`[API] Fetch error for ${endpoint}:`, err);
            throw err;
        }
    }

    async loginWithFirebase(idToken) {
        return this.request('/auth/firebase', {
            method: 'POST',
            body: JSON.stringify({ idToken })
        });
    }

    async getProfile(playerId) {
        return this.request(`/auth/profile/${playerId}`);
    }

    async updateProfile(playerId, data) {
        return this.request(`/auth/profile/${playerId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    // Rooms
    async getRooms() {
        return this.request('/rooms');
    }

    async createRoom(data) {
        return this.request('/rooms', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async joinRoom(roomId, data) {
        return this.request(`/rooms/${roomId}/join`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async leaveRoom(roomId) {
        return this.request(`/rooms/${roomId}/leave`, {
            method: 'POST'
        });
    }

    async toggleReady(roomId, ready) {
        return this.request(`/rooms/${roomId}/ready`, {
            method: 'POST',
            body: JSON.stringify({ ready })
        });
    }

    // Game
    async startGame(roomId) {
        return this.request(`/game/${roomId}/start`, {
            method: 'POST'
        });
    }

    async submitAnswer(roomId, playerUsername, answerIndex) {
        return this.request(`/game/${roomId}/answer`, {
            method: 'POST',
            body: JSON.stringify({ playerUsername, answerIndex })
        });
    }

    async quitGame(roomId) {
        return this.request(`/game/${roomId}/quit`, {
            method: 'POST'
        });
    }

    async resetGame(roomId) {
        return this.request(`/game/${roomId}/reset`, {
            method: 'POST'
        });
    }

    // Leaderboard
    async getLeaderboard(category = 'balance') {
        return this.request(`/leaderboard?category=${category}`);
    }

    // Transactions
    async getTransactions(playerId, limit = 50, offset = 0) {
        return this.request(`/transactions/${playerId}?limit=${limit}&offset=${offset}`);
    }

    // Quests
    async getQuests(playerId) {
        return this.request(`/quests/${playerId}`);
    }

    async claimQuestReward(playerId, questId) {
        return this.request(`/quests/${playerId}/claim/${questId}`, {
            method: 'POST'
        });
    }
}

export const api = new ApiService();
