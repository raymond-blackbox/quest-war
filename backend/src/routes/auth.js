import express from 'express';
import authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { loginSchema, updateProfileSchema, getProfileSchema } from '../validations/auth.validation.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Manual login (Deprecated)
 *     description: Manual login is disabled. Please use "Sign in with Google".
 *     tags: [Auth]
 *     responses:
 *       403:
 *         description: Manual login is disabled.
 */
router.post('/login', (req, res) => {
    res.status(403).json({ error: 'Manual login is disabled. Please use "Sign in with Google".' });
});

/**
 * @swagger
 * /api/auth/firebase:
 *   post:
 *     summary: Authenticate with Firebase
 *     description: Authenticate using a Firebase ID token.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully authenticated.
 *       401:
 *         description: Invalid token.
 */
router.post('/firebase', validate(loginSchema), authController.loginWithFirebase);

/**
 * @swagger
 * /api/auth/profile/{playerId}:
 *   get:
 *     summary: Get player profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Player profile data.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Player not found.
 */
router.get('/profile/:playerId', authMiddleware, validate(getProfileSchema), authController.getProfile);

/**
 * @swagger
 * /api/auth/profile/{playerId}:
 *   patch:
 *     summary: Update player profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated.
 */
router.patch('/profile/:playerId', authMiddleware, validate(updateProfileSchema), authController.updateProfile);

export default router;
