import { Request, Response, NextFunction } from 'express';
import { RoomService } from '../services/room.service';

const roomService = RoomService.getInstance();

export const createRoom = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Generate a new room. The host ID will be assigned when they join via sockets.
    const room = roomService.createRoom('');
    return res.status(201).json({
      success: true,
      message: 'Room created successfully',
      room: {
        id: room.id,
        createdAt: room.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const validateRoom = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required',
      });
    }

    const room = roomService.getRoom(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        exists: false,
        message: 'Room not found',
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      room: {
        id: room.id,
        participantCount: Object.keys(room.participants).length,
      },
    });
  } catch (error) {
    next(error);
  }
};
