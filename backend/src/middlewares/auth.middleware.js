import { admin } from '../services/firebase.js';
import { AuthError } from '../utils/errors.js';
import { asyncHandler } from './error.middleware.js';

export const authMiddleware = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn(`[AUTH] Missing/invalid header for ${req.path}: ${authHeader}`);
        throw new AuthError('Missing or invalid authorization header');
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log(`[AUTH] Token verified for user: ${decodedToken.uid}`);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error(`[AUTH] Token verification failed for ${req.path}:`, error.message);
        throw new AuthError('Invalid or expired token');
    }
});
