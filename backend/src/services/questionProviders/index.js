/**
 * Question Provider Factory
 * Returns the appropriate question provider based on game type.
 * This enables different question types (math, trivia, etc.) to be added easily.
 */

import * as mathProvider from './mathProvider.js';

// Provider registry - lazy loading for future providers
const providers = {
    math: mathProvider,
    // Future: trivia: () => import('./triviaProvider.js'),
};

/**
 * Game types enum for type-safe game type selection
 */
export const GAME_TYPES = {
    MATH: 'math',
    // Future game types can be added here
};

/**
 * Get the question provider for a given game type
 * @param {string} gameType - The type of game (default: 'math')
 * @returns {Object} The question provider with generateQuestion, DIFFICULTY, etc.
 */
export function getQuestionProvider(gameType = GAME_TYPES.MATH) {
    const provider = providers[gameType];
    if (!provider) {
        console.warn(`Unknown game type "${gameType}", falling back to math`);
        return providers.math;
    }
    return provider;
}

/**
 * Get list of available game types
 * @returns {string[]} Array of available game type identifiers
 */
export function getAvailableGameTypes() {
    return Object.keys(providers);
}
