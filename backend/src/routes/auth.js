import express from 'express';
import authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { loginSchema, updateProfileSchema, getProfileSchema } from '../validations/auth.validation.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * @deprecated Manual login is disabled.
 */
router.post('/login', (req, res) => {
    res.status(403).json({ error: 'Manual login is disabled. Please use "Sign in with Google".' });
});

/**
 * POST /api/auth/firebase
 * Authenticate with Firebase ID token
 */
router.post('/firebase', validate(loginSchema), authController.loginWithFirebase);

/**
 * GET /api/auth/profile/:playerId
 * Get player profile
 */
router.get('/profile/:playerId', authMiddleware, validate(getProfileSchema), authController.getProfile);

/**
 * PATCH /api/auth/profile/:playerId
 * Update player profile (protected)
 */
router.patch('/profile/:playerId', authMiddleware, validate(updateProfileSchema), authController.updateProfile);

export default router;
