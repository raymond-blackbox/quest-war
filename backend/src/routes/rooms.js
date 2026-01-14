import express from 'express';
import roomController from '../controllers/room.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

import { validate } from '../middlewares/validation.middleware.js';
import { createRoomSchema, joinRoomSchema } from '../validations/room.validation.js';

const router = express.Router();

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: List available rooms
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of rooms.
 */
router.get('/', authMiddleware, roomController.listRooms);

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *               isSolo:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Room created.
 */
router.post('/', authMiddleware, validate(createRoomSchema), roomController.createRoom);

/**
 * @swagger
 * /api/rooms/{id}/players:
 *   post:
 *     summary: Join a room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Joined successfully.
 */
router.post('/:id/players', authMiddleware, validate(joinRoomSchema), roomController.joinRoom);

/**
 * @swagger
 * /api/rooms/{id}/players/me:
 *   patch:
 *     summary: Toggle ready status
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ready:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Status updated.
 */
router.patch('/:id/players/me', authMiddleware, roomController.toggleReady);

/**
 * @swagger
 * /api/rooms/{id}/players/me:
 *   delete:
 *     summary: Leave a room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Left successfully.
 */
router.delete('/:id/players/me', authMiddleware, roomController.leaveRoom);



export default router;
