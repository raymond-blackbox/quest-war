import { getFirestore, admin } from '../services/firebase.js';

const getPlayersCollection = () => getFirestore().collection('players');

export class UserRepository {
    async findById(id) {
        const doc = await getPlayersCollection().doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }

    async findByField(field, value) {
        const snapshot = await getPlayersCollection()
            .where(field, '==', value)
            .limit(1)
            .get();
        return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }

    async create(id, data) {
        const playerRef = getPlayersCollection().doc(id);
        await playerRef.set({
            ...data,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return this.findById(id);
    }

    async update(id, data) {
        const playerRef = getPlayersCollection().doc(id);
        await playerRef.update({
            ...data,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return this.findById(id);
    }

    async runTransaction(operations) {
        return getFirestore().runTransaction(operations);
    }
}

export default new UserRepository();
