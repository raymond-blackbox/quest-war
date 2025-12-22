/**
 * Player Account Initialization Script
 * Creates 20 test player accounts in Firestore
 * 
 * Usage: node scripts/init-players.js
 * Requires: serviceAccountKey.json in backend folder
 */

import admin from 'firebase-admin';
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
    readFileSync('../backend/serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'questwardb' });

async function createPlayers() {
    console.log('Creating test player accounts...');

    const batch = db.batch();

    for (let i = 1; i <= 5; i++) {
        const username = `play${i}`;
        const password = `play${i}pass`;
        const passwordHash = await bcrypt.hash(password, 10);

        const playerRef = db.collection('players').doc();
        batch.set(playerRef, {
            username,
            passwordHash,
            tokens: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`  Created: ${username} / ${password}`);
    }

    await batch.commit();
    console.log('\n✓ 20 player accounts created successfully!');
    console.log('\nTest credentials:');
    console.log('  Username: play1, play2, ... play20');
    console.log('  Password: play1pass, play2pass, ... play20pass');

    process.exit(0);
}

createPlayers().catch((error) => {
    console.error('Error creating players:', error);
    process.exit(1);
});
