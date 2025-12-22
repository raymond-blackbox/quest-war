const API_BASE = '/api';

class ApiService {
    async request(endpoint, options = {}) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    }

    // Auth
    async login(username, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    async register({ username, password, email }) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, email })
        });
    }

    async loginWithGoogle(idToken) {
        return this.request('/auth/google', {
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

    async leaveRoom(roomId, playerId) {
        return this.request(`/rooms/${roomId}/leave`, {
            method: 'POST',
            body: JSON.stringify({ playerId })
        });
    }

    async toggleReady(roomId, playerId, ready) {
        return this.request(`/rooms/${roomId}/ready`, {
            method: 'POST',
            body: JSON.stringify({ playerId, ready })
        });
    }

    // Game
    async startGame(roomId, playerId) {
        return this.request(`/game/${roomId}/start`, {
            method: 'POST',
            body: JSON.stringify({ playerId })
        });
    }

    async submitAnswer(roomId, playerId, playerUsername, answerIndex) {
        return this.request(`/game/${roomId}/answer`, {
            method: 'POST',
            body: JSON.stringify({ playerId, playerUsername, answerIndex })
        });
    }

    async quitGame(roomId, playerId) {
        return this.request(`/game/${roomId}/quit`, {
            method: 'POST',
            body: JSON.stringify({ playerId })
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
}

export const api = new ApiService();
