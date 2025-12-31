import { initializeFirebase } from '../src/services/firebase.js';
import { updateUserStats } from '../src/services/userStats.js';
import logger from '../src/services/logger.js';

async function testUpdateUserStats() {
    try {
        console.log('Initializing Firebase...');
        initializeFirebase();

        const testPlayerId = 'test-player-id'; // Use a dummy or real test ID
        const gameType = 'math';
        const difficulty = 'easy';
        const answeredCount = 5;
        const correctCount = 3;

        console.log(`Updating stats for ${testPlayerId}...`);
        await updateUserStats(testPlayerId, gameType, difficulty, answeredCount, correctCount);

        console.log('Stats updated successfully (check Firestore if possible or logs above).');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testUpdateUserStats();
