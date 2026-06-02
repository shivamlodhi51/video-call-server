import { Room, Participant } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class RoomService {
  private static instance: RoomService;
  // In-memory store: roomId -> Room
  private rooms: Map<string, Room> = new Map();

  private constructor() {}

  public static getInstance(): RoomService {
    if (!RoomService.instance) {
      RoomService.instance = new RoomService();
    }
    return RoomService.instance;
  }

  /**
   * Generates a unique 9-character room ID (format: xxx-xxx-xxx)
   */
  private generateRoomId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let id = '';
    for (let i = 0; i < 9; i++) {
      if (i > 0 && i % 3 === 0) {
        id += '-';
      }
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * Creates a new room with a host
   */
  public createRoom(hostId: string): Room {
    let roomId = this.generateRoomId();
    // Ensure uniqueness
    while (this.rooms.has(roomId)) {
      roomId = this.generateRoomId();
    }

    const newRoom: Room = {
      id: roomId,
      hostId,
      participants: {},
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  /**
   * Retrieves a room by its ID
   */
  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Checks if a room exists
   */
  public hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  /**
   * Adds a participant to a room
   */
  public joinRoom(roomId: string, participant: Participant): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.participants[participant.socketId] = participant;
    
    // If the room has no hostId set (e.g. host disconnected and we want to reassign or set initial host)
    if (!room.hostId) {
      room.hostId = participant.socketId;
    }

    return true;
  }

  /**
   * Removes a participant from a room. If the room is empty, it cleans up the room.
   */
  public leaveRoom(roomId: string, socketId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    if (room.participants[socketId]) {
      delete room.participants[socketId];
    }

    // Clean up room if no participants left
    if (Object.keys(room.participants).length === 0) {
      this.rooms.delete(roomId);
      return undefined;
    }

    // Reassign host if the host left
    if (room.hostId === socketId) {
      const remainingSocketIds = Object.keys(room.participants);
      room.hostId = remainingSocketIds[0] || '';
    }

    return room;
  }

  /**
   * Updates a participant's device statuses (mute, camera, screen-share)
   */
  public updateParticipantState(
    roomId: string,
    socketId: string,
    updates: Partial<Omit<Participant, 'socketId' | 'username' | 'joinedAt'>>
  ): Participant | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const participant = room.participants[socketId];
    if (!participant) return undefined;

    room.participants[socketId] = {
      ...participant,
      ...updates,
    };

    return room.participants[socketId];
  }

  /**
   * Returns all active rooms (for debug/admin purposes)
   */
  public getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }
}
