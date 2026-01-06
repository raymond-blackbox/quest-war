import roomService from '../services/room.service.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

export class RoomController {
    createRoom = asyncHandler(async (req, res) => {
        const room = await roomService.createRoom({
            ...req.body,
            hostId: req.user.uid
        });
        res.json(room);
    });

    joinRoom = asyncHandler(async (req, res) => {
        const result = await roomService.joinRoom(req.params.id, {
            ...req.body,
            playerId: req.user.uid
        });
        res.json(result);
    });

    toggleReady = asyncHandler(async (req, res) => {
        const result = await roomService.toggleReady(req.params.id, req.user.uid, req.body.ready);
        res.json(result);
    });

    leaveRoom = asyncHandler(async (req, res) => {
        const result = await roomService.leaveRoom(req.params.id, req.user.uid);
        res.json(result);
    });

    listRooms = asyncHandler(async (req, res) => {
        const rooms = await roomService.listAvailableRooms();
        res.json(rooms);
    });
}

export default new RoomController();
