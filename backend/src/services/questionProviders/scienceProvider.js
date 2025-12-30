/**
 * Science Question Provider
 * Database-backed provider for science questions.
 */

import { createDatabaseProvider } from './databaseProvider.js';

const config = {
    gameType: 'science',
    name: 'Science Challenge',
    description: 'Test your knowledge of biology, chemistry, physics, and more!',
    difficulties: ['easy', 'medium', 'hard']
};

// Create the provider using the database provider factory
const provider = createDatabaseProvider(config);

// Export all provider properties
export const DIFFICULTY = provider.DIFFICULTY;
export const providerInfo = provider.providerInfo;
export const generateQuestion = provider.generateQuestion;
export const generateQuestionSet = provider.generateQuestionSet;
