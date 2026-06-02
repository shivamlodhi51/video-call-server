import { Router } from 'express';
import { createRoom, validateRoom } from '../controllers/room.controller';

const router = Router();

// POST /api/rooms - Create a new room
router.post('/', createRoom);

// GET /api/rooms/validate/:roomId - Validate existing room
router.get('/validate/:roomId', validateRoom);

export default router;
