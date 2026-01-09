import { admin } from '../services/firebase.js';
import logger from '../services/logger.js';
import { AuthError } from '../utils/errors.js';
import { asyncHandler } from './error.middleware.js';

export const authMiddleware = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn(`[AUTH] Missing/invalid header for ${req.path}: ${authHeader}`);
        throw new AuthError('Missing or invalid authorization header');
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        logger.info(`[AUTH] Token verified for user: ${decodedToken.uid}`);
        req.user = decodedToken;
        next();
    } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
            logger.error(`[AUTH] Token verification failed for ${req.path}:`, error);
        }
        throw new AuthError('Invalid or expired token');
    }
});
