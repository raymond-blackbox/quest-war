import express from 'express';
import roomController from '../controllers/room.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/rooms
 * List available rooms
 */
router.get('/', authMiddleware, roomController.listRooms);

/**
 * POST /api/rooms
 * Create a new room (protected)
 */
router.post('/', authMiddleware, roomController.createRoom);

/**
 * POST /api/rooms/:id/join
 * Join a room
 */
router.post('/:id/join', authMiddleware, roomController.joinRoom);

/**
 * POST /api/rooms/:id/ready
 * Toggle ready status
 */
router.post('/:id/ready', authMiddleware, roomController.toggleReady);

/**
 * POST /api/rooms/:id/leave
 * Leave a room
 */
router.post('/:id/leave', authMiddleware, roomController.leaveRoom);

export default router;
