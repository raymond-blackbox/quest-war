import roomRepository from '../repositories/room.repository.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import bcrypt from 'bcrypt';

export class RoomService {
    async createRoom(data) {
        const { name, password, isSolo, hostId, ...settings } = data;

        const hashedPassword = isSolo ? null : (password ? await bcrypt.hash(password, 10) : null);

        const roomData = {
            name,
            password: hashedPassword,
            isPrivate: !isSolo && !!password,
            isSolo,
            hostId,
            settings,
            status: 'waiting',
            players: {
                [hostId]: {
                    username: data.hostUsername,
                    displayName: data.hostDisplayName || data.hostUsername,
                    ready: isSolo,
                    score: 0,
                    tokensEarned: 0
                }
            },
            createdAt: Date.now()
        };

        return roomRepository.create(roomData);
    }

    async joinRoom(roomId, playerData) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new NotFoundError('Room not found');

        if (room.status !== 'waiting') throw new AppError('Game already in progress', 400);

        const { playerId, password } = playerData;

        const currentPlayers = Object.keys(room.players || {});
        if (!room.players?.[playerId] && currentPlayers.length >= 5) {
            throw new AppError('Room is full', 409);
        }

        if (room.isPrivate || room.password) {
            if (!password) throw new AppError('Password required', 401);
            const match = await bcrypt.compare(password, room.password);
            if (!match) throw new AppError('Invalid password', 401);
        }

        if (room.isSolo && room.hostId !== playerId) {
            throw new AppError('Solo rooms cannot be joined', 403);
        }

        await roomRepository.update(`${roomId}/players/${playerId}`, {
            username: playerData.playerUsername,
            displayName: playerData.playerDisplayName || playerData.playerUsername,
            ready: !!(room.isSolo && room.hostId === playerId),
            score: 0,
            tokensEarned: 0
        });

        return { success: true, roomId };
    }

    async toggleReady(roomId, playerId, ready) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new NotFoundError('Room not found');

        await roomRepository.update(`${roomId}/players/${playerId}`, { ready });
        return { success: true };
    }

    async leaveRoom(roomId, playerId) {
        const room = await roomRepository.findById(roomId);
        if (!room) return { success: true };

        // If host leaves during waiting phase, dismiss the entire room
        if (room.hostId === playerId && room.status === 'waiting') {
            await roomRepository.delete(roomId);
            return { success: true, roomDismissed: true };
        }

        await roomRepository.delete(`${roomId}/players/${playerId}`);

        // Check if room is empty
        const updatedRoom = await roomRepository.findById(roomId);
        if (!updatedRoom || !updatedRoom.players || Object.keys(updatedRoom.players).length === 0) {
            await roomRepository.delete(roomId);
        }

        return { success: true };
    }

    async listAvailableRooms() {
        const rooms = await roomRepository.getAllWaiting();
        return rooms.map(r => ({
            id: r.id,
            name: r.name,
            isPrivate: r.isPrivate,
            playerCount: Object.keys(r.players || {}).length,
            hostUsername: r.players[r.hostId]?.displayName || r.players[r.hostId]?.username
        }));
    }
}

export default new RoomService();
