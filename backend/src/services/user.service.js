import userRepository from '../repositories/user.repository.js';
import { admin, getFirestore } from '../services/firebase.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import leaderboardService from './leaderboard.service.js';

export class UserService {
    async getProfile(playerId) {
        const player = await userRepository.findById(playerId);
        if (!player) {
            throw new NotFoundError('Player not found');
        }
        return this.toPlayerResponse(player);
    }

    async updateDisplayName(playerId, displayName) {
        const NAME_CHANGE_COST = 500;
        const displayNameKey = displayName.toLowerCase();

        // Check for conflict
        const conflict = await userRepository.findByField('displayNameLower', displayNameKey);
        if (conflict && conflict.id !== playerId) {
            throw new AppError('Display name already taken', 409, 'NAME_TAKEN');
        }

        return userRepository.runTransaction(async (transaction) => {
            const playerRef = getFirestore().collection('players').doc(playerId);
            const playerDoc = await transaction.get(playerRef);

            if (!playerDoc.exists) {
                throw new NotFoundError('Player not found');
            }

            const playerData = playerDoc.data();
            const currentTokens = Number(playerData.tokens || 0);

            if (playerData.displayName === displayName) {
                return this.toPlayerResponse({ id: playerDoc.id, ...playerData });
            }

            if (currentTokens < NAME_CHANGE_COST) {
                throw new AppError('Insufficient tokens', 402, 'INSUFFICIENT_FUNDS');
            }

            const updatedData = {
                displayName: displayName,
                displayNameLower: displayNameKey,
                tokens: currentTokens - NAME_CHANGE_COST,
            };

            transaction.update(playerRef, {
                ...updatedData,
                updatedAt: getFirestore().constructor.FieldValue.serverTimestamp(),
            });

            // Sync with leaderboard
            leaderboardService.syncPlayerWithTransaction(transaction, playerId, {
                tokens: updatedData.tokens,
                displayName: updatedData.displayName
            });

            return {
                id: playerId,
                ...playerData,
                ...updatedData,
            };
        });
    }

    toPlayerResponse(player) {
        return {
            id: player.id,
            username: player.username,
            displayName: player.displayName || player.username,
            email: player.email || null,
            tokens: Number(player.tokens || 0),
        };
    }

    async findOrCreateUser(decodedToken) {
        const { uid, email, name, firebase, email_verified } = decodedToken;
        const provider = firebase?.sign_in_provider || 'email';

        let user = await userRepository.findById(uid);

        if (!user) {
            // Check for email collision
            if (email) {
                const conflictingUser = await userRepository.findByField('email', email.trim().toLowerCase());
                if (conflictingUser) {
                    throw new AppError('Email already registered with another account', 409, 'EMAIL_CONFLICT');
                }
            }

            const username = await this.generateUniqueUsername(name || email || 'adventurer');
            user = await userRepository.create(uid, {
                username,
                displayName: name || username,
                displayNameLower: (name || username).toLowerCase(),
                email: email ? email.trim().toLowerCase() : null,
                authProvider: provider,
                firebaseUid: uid,
                tokens: 0,
            });
        }

        return user;
    }

    // Helper method moved from old route
    async generateUniqueUsername(baseInput) {
        let base = baseInput.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15);
        if (!base || base.length < 3) base = 'adventurer';

        let candidate = base;
        let counter = 1;
        while (counter < 50) {
            const existing = await userRepository.findByField('username', candidate);
            if (!existing) return candidate;
            candidate = `${base}${counter}`;
            counter++;
        }
        return `${base}${Date.now().toString().slice(-4)}`;
    }
}

export default new UserService();
