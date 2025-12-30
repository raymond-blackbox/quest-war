/**
 * Seed Questions Script
 * Loads questions from a CSV file into Firestore.
 * 
 * Usage:
 *   node scripts/seedQuestions.js --type science --file data/scienceQuestions.csv
 *   node scripts/seedQuestions.js --type science  (uses default file path)
 * 
 * Options:
 *   --type    Game type (required): science, trivia, etc.
 *   --file    Path to CSV file (default: data/{type}Questions.csv)
 *   --clear   Clear existing questions of this type before seeding
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        type: null,
        file: null,
        clear: false
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--type' && args[i + 1]) {
            options.type = args[++i];
        } else if (args[i] === '--file' && args[i + 1]) {
            options.file = args[++i];
        } else if (args[i] === '--clear') {
            options.clear = true;
        }
    }

    return options;
}

// Parse CSV content
function parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV file must have a header row and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^\ufeff/, '')); // Remove BOM if present
    const questions = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle CSV with quoted fields (for questions with commas)
        const values = parseCSVLine(line);

        if (values.length < headers.length) {
            console.warn(`Skipping line ${i + 1}: not enough columns`);
            continue;
        }

        const question = {};
        headers.forEach((header, index) => {
            question[header] = values[index]?.trim() || '';
        });

        questions.push(question);
    }

    return questions;
}

// Parse a single CSV line handling quoted fields
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);

    return values;
}

// Initialize Firebase Admin
function initFirebase() {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        path.join(__dirname, '..', 'serviceAccountKey.json');

    if (!fs.existsSync(serviceAccountPath)) {
        console.error(`Firebase service account not found at: ${serviceAccountPath}`);
        console.error('Set GOOGLE_APPLICATION_CREDENTIALS environment variable or place serviceAccountKey.json in backend/');
        process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    const app = initializeApp({
        credential: cert(serviceAccount)
    });

    // Use the specific database 'questwardb' (same as main app)
    return getFirestore(app, 'questwardb');
}

// Clear existing questions of a type
async function clearQuestions(db, gameType) {
    console.log(`Clearing existing ${gameType} questions...`);

    const snapshot = await db.collection('questions')
        .where('gameType', '==', gameType)
        .get();

    const batch = db.batch();
    let count = 0;

    snapshot.forEach(doc => {
        batch.delete(doc.ref);
        count++;
    });

    if (count > 0) {
        await batch.commit();
        console.log(`Deleted ${count} existing questions`);
    }
}

// Seed questions to Firestore
async function seedQuestions(db, gameType, questions) {
    console.log(`Seeding ${questions.length} ${gameType} questions...`);

    const batch = db.batch();
    const now = new Date();

    for (const q of questions) {
        const docRef = db.collection('questions').doc();

        batch.set(docRef, {
            gameType,
            difficulty: q.difficulty || 'medium',
            category: q.category || null,
            question: q.question,
            option1: q.option1,
            option2: q.option2,
            option3: q.option3,
            option4: q.option4,
            correctIndex: parseInt(q.correctIndex, 10),
            questionChinese: q.questionChinese || null,
            optionChinese1: q.optionChinese1 || null,
            optionChinese2: q.optionChinese2 || null,
            optionChinese3: q.optionChinese3 || null,
            optionChinese4: q.optionChinese4 || null,
            enabled: true,
            createdAt: now,
            updatedAt: now
        });
    }

    await batch.commit();
    console.log(`Successfully seeded ${questions.length} questions!`);
}

// Main function
async function main() {
    const options = parseArgs();

    if (!options.type) {
        console.error('Error: --type is required');
        console.error('Usage: node scripts/seedQuestions.js --type science --file data/scienceQuestions.csv');
        process.exit(1);
    }

    const csvFile = options.file || path.join(__dirname, '..', 'data', `${options.type}Questions.csv`);

    if (!fs.existsSync(csvFile)) {
        console.error(`CSV file not found: ${csvFile}`);
        process.exit(1);
    }

    console.log(`Loading questions from: ${csvFile}`);
    const content = fs.readFileSync(csvFile, 'utf8');
    const questions = parseCSV(content);

    if (questions.length === 0) {
        console.error('No questions found in CSV file');
        process.exit(1);
    }

    console.log(`Parsed ${questions.length} questions`);

    const db = initFirebase();

    if (options.clear) {
        await clearQuestions(db, options.type);
    }

    await seedQuestions(db, options.type, questions);

    console.log('Done!');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
