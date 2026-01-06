import { getFirestore, admin } from '../services/firebase.js';

const getQuestProgressCollection = () => getFirestore().collection('questProgress');

export class QuestRepository {
    async getProgress(playerId) {
        const doc = await getQuestProgressCollection().doc(playerId).get();
        return doc.exists ? doc.data() : { playerId, quests: {} };
    }

    async updateProgress(playerId, questsUpdate) {
        const progressRef = getQuestProgressCollection().doc(playerId);
        await progressRef.set({
            playerId,
            quests: questsUpdate,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return this.getProgress(playerId);
    }
}

export default new QuestRepository();
