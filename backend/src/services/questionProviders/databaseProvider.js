/**
 * Database Question Provider
 * Base module for fetching questions from Firestore.
 * Used by science, trivia, and other database-backed question types.
 */

import { getFirestore } from '../firebase.js';

// In-memory cache per game type to avoid repeated DB calls within a game
const questionCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Fetch questions from Firestore for a specific game type
 * @param {string} gameType - The game type to fetch questions for
 * @param {string} difficulty - Optional difficulty filter
 * @returns {Promise<Array>} Array of question documents
 */
async function fetchQuestionsFromDb(gameType, difficulty = null) {
    const cacheKey = `${gameType}-${difficulty || 'all'}`;
    const cached = questionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.questions;
    }

    const db = getFirestore();
    let query = db.collection('questions')
        .where('gameType', '==', gameType)
        .where('enabled', '==', true);

    if (difficulty) {
        query = query.where('difficulty', '==', difficulty);
    }

    const snapshot = await query.get();
    const questions = [];

    snapshot.forEach(doc => {
        questions.push({ id: doc.id, ...doc.data() });
    });

    // Cache the results
    questionCache.set(cacheKey, {
        questions,
        timestamp: Date.now()
    });

    return questions;
}

/**
 * Clear the question cache (useful when seeding new questions)
 * @param {string} gameType - Optional: clear only for specific game type
 */
export function clearQuestionCache(gameType = null) {
    if (gameType) {
        for (const key of questionCache.keys()) {
            if (key.startsWith(gameType)) {
                questionCache.delete(key);
            }
        }
    } else {
        questionCache.clear();
    }
}

/**
 * Create a database-backed question provider
 * @param {Object} config - Provider configuration
 * @param {string} config.gameType - The game type identifier
 * @param {string} config.name - Display name for the provider
 * @param {string} config.description - Description of the game type
 * @param {Array<string>} config.difficulties - Available difficulty levels
 * @returns {Object} Question provider with generateQuestion and metadata
 */
export function createDatabaseProvider(config) {
    const { gameType, name, description, difficulties } = config;

    const DIFFICULTY = {};
    difficulties.forEach(d => {
        DIFFICULTY[d.toUpperCase()] = d;
    });

    const providerInfo = {
        type: gameType,
        name,
        description,
        difficulties,
        isDatabase: true
    };

    /**
     * Generate a random question from the database
     * @param {string} difficulty - The difficulty level
     * @returns {Promise<Object>} Question with question, options, correctIndex
     */
    async function generateQuestion(difficulty = difficulties[1] || difficulties[0]) {
        const questions = await fetchQuestionsFromDb(gameType, difficulty);

        if (questions.length === 0) {
            // Fallback: try without difficulty filter
            const allQuestions = await fetchQuestionsFromDb(gameType, null);
            if (allQuestions.length === 0) {
                throw new Error(`No questions available for game type: ${gameType}`);
            }
            const randomQuestion = allQuestions[Math.floor(Math.random() * allQuestions.length)];
            return formatQuestion(randomQuestion);
        }

        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        return formatQuestion(randomQuestion);
    }

    /**
     * Format a database question to the standard format with shuffled options
     */
    function formatQuestion(dbQuestion) {
        // Options are stored as option1..4 and optionally optionChinese1..4 in DB
        const pairs = [
            { en: dbQuestion.option1 || '', zh: dbQuestion.optionChinese1 || '' },
            { en: dbQuestion.option2 || '', zh: dbQuestion.optionChinese2 || '' },
            { en: dbQuestion.option3 || '', zh: dbQuestion.optionChinese3 || '' },
            { en: dbQuestion.option4 || '', zh: dbQuestion.optionChinese4 || '' }
        ].filter(p => p.en !== '');

        const originalCorrectIndex = Number(dbQuestion.correctIndex);
        const correctAnswerEn = pairs[originalCorrectIndex]?.en;

        // Shuffle pairs together so translations stay synchronized
        const shuffledPairs = shuffleArray(pairs);

        // Find new position of correct answer using the English key as identifier
        const newCorrectIndex = shuffledPairs.findIndex(p => p.en === correctAnswerEn);

        return {
            question: {
                en: dbQuestion.question || '',
                zh: dbQuestion.questionChinese || ''
            },
            options: shuffledPairs, // Array of {en, zh}
            correctIndex: newCorrectIndex
        };
    }

    /**
     * Generate a set of questions
     * @param {number} count - Number of questions to generate
     * @param {string} difficulty - Difficulty level
     * @returns {Promise<Array>} Array of questions
     */
    async function generateQuestionSet(count = 10, difficulty = difficulties[1] || difficulties[0]) {
        const questions = await fetchQuestionsFromDb(gameType, difficulty);

        if (questions.length === 0) {
            throw new Error(`No questions available for game type: ${gameType}`);
        }

        // Shuffle and take up to 'count' questions
        const shuffled = shuffleArray(questions);
        const selected = shuffled.slice(0, Math.min(count, shuffled.length));

        return selected.map(formatQuestion);
    }

    return {
        DIFFICULTY,
        providerInfo,
        generateQuestion,
        generateQuestionSet
    };
}
