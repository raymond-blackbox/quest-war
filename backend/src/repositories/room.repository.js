import { getRealtimeDb } from '../services/firebase.js';

export class RoomRepository {
    async findById(id) {
        const snapshot = await getRealtimeDb().ref(`rooms/${id}`).get();
        return snapshot.exists() ? { id: snapshot.key, ...snapshot.val() } : null;
    }

    async create(data) {
        const roomRef = getRealtimeDb().ref('rooms').push();
        await roomRef.set(data);
        return { roomId: roomRef.key, ...data };
    }

    async update(id, data) {
        await getRealtimeDb().ref(`rooms/${id}`).update(data);
        return this.findById(id);
    }

    async delete(id) {
        await getRealtimeDb().ref(`rooms/${id}`).remove();
    }

    async getAllWaiting() {
        const snapshot = await getRealtimeDb().ref('rooms').get();
        if (!snapshot.exists()) return [];

        const rooms = [];
        snapshot.forEach((child) => {
            const room = child.val();
            if (room.status === 'waiting' && !room.isSolo) {
                rooms.push({ id: child.key, ...room });
            }
        });
        return rooms;
    }
}

export default new RoomRepository();
