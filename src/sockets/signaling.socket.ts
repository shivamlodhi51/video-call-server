import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/room.service';
import { Participant, ChatMessage, SignalData } from '../types';
import { v4 as uuidv4 } from 'uuid';

const roomService = RoomService.getInstance();

export const setupSignalingSocket = (io: Server) => {
  // Map to quickly look up roomId for a given socketId on disconnect
  const socketToRoomMap = new Map<string, string>();

  io.on('connection', (socket: Socket) => {
    console.log(`[SOCKET CONNECTED]: ${socket.id}`);

    /**
     * Event: join-room
     * Flow:
     * 1. A new participant joins a meeting room.
     * 2. Server checks room validity, creates the participant record, and registers the socket in the room channel.
     * 3. Server sends list of current participants to the joining user.
     * 4. Server broadcasts 'user-joined' to all existing participants in the room.
     * 5. Upon receiving 'user-joined', each existing participant will initiate a WebRTC connection (SDP Offer) to the new participant.
     */
    socket.on('join-room', ({ roomId, username }: { roomId: string; username: string }) => {
      console.log(`[JOIN ROOM]: User "${username}" (${socket.id}) joining room "${roomId}"`);

      // Validate room existence
      const room = roomService.getRoom(roomId);
      if (!room) {
        socket.emit('error-message', { message: 'Room does not exist or has expired.' });
        return;
      }

      // Check if username is already taken in the room to avoid confusion
      const isUsernameTaken = Object.values(room.participants).some(
        (p) => p.username.toLowerCase() === username.toLowerCase()
      );
      const finalUsername = isUsernameTaken ? `${username} (${socket.id.slice(0, 4)})` : username;

      // Create participant model
      const participant: Participant = {
        socketId: socket.id,
        username: finalUsername,
        joinedAt: Date.now(),
        isMuted: false,
        isCameraOff: false,
        isScreenSharing: false,
      };

      // Add to room service database
      roomService.joinRoom(roomId, participant);
      socketToRoomMap.set(socket.id, roomId);
      socket.join(roomId);

      // 1. Send all existing participants to the joiner
      const activeParticipants = Object.values(room.participants).filter(
        (p) => p.socketId !== socket.id
      );
      socket.emit('room-ready', {
        roomId,
        participants: activeParticipants,
        hostId: room.hostId,
      });

      // 2. Notify all existing participants in the room that a new user has joined
      // Existing clients will catch this event and immediately generate an SDP Offer for this new user.
      socket.to(roomId).emit('user-joined', {
        participant,
      });
    });

    /**
     * Event: send-signal (WebRTC SDP offer/answer/ICE exchange)
     * Flow:
     * 1. WebRTC signaling details (SDP offers, SDP answers, ICE candidates) are peer-to-peer specific.
     * 2. The server acts as a pure transparent relay.
     * 3. It accepts a payload addressed to a specific participant ('to') and sends it directly.
     */
    socket.on('send-signal', ({ to, signal }: { to: string; signal: SignalData }) => {
      // Forward the signaling message (offer, answer, or ice candidate) to the target client
      io.to(to).emit('signaling-message', {
        from: socket.id,
        signal,
      });
    });

    /**
     * Event: update-media-state (Mute mic, camera toggle, screen sharing toggle)
     * Flow:
     * 1. Participant updates their camera, mic, or screen sharing state locally.
     * 2. Server updates the participant state in RoomService.
     * 3. Server broadcasts 'participant-state-updated' to all other room members.
     */
    socket.on(
      'update-media-state',
      (updates: Partial<Omit<Participant, 'socketId' | 'username' | 'joinedAt'>>) => {
        const roomId = socketToRoomMap.get(socket.id);
        if (!roomId) return;

        const updatedParticipant = roomService.updateParticipantState(roomId, socket.id, updates);
        if (updatedParticipant) {
          io.to(roomId).emit('participant-state-updated', {
            socketId: socket.id,
            updates,
          });
        }
      }
    );

    /**
     * Event: send-chat-message
     * Flow:
     * 1. Participant types a text chat message and clicks send.
     * 2. Server generates a unique message ID and attaches a timestamp.
     * 3. Server broadcasts 'chat-message' to the entire room.
     */
    socket.on('send-chat-message', ({ text }: { text: string }) => {
      const roomId = socketToRoomMap.get(socket.id);
      if (!roomId) return;

      const room = roomService.getRoom(roomId);
      if (!room) return;

      const participant = room.participants[socket.id];
      if (!participant) return;

      const message: ChatMessage = {
        id: uuidv4(),
        roomId,
        senderId: socket.id,
        senderName: participant.username,
        text,
        timestamp: Date.now(),
      };

      io.to(roomId).emit('chat-message', message);
    });

    /**
     * Event: leave-call (Explicitly triggered by participant exiting the call)
     */
    socket.on('leave-call', () => {
      handleUserDisconnect(socket);
    });

    /**
     * Event: disconnect (Automatically triggered by browser close, tab close, or network failure)
     */
    socket.on('disconnect', () => {
      console.log(`[SOCKET DISCONNECTED]: ${socket.id}`);
      handleUserDisconnect(socket);
    });
  });

  /**
   * Helper: handleUserDisconnect
   * Cleans up room list, assigns new room host if host left, and alerts remaining peers.
   */
  const handleUserDisconnect = (socket: Socket) => {
    const roomId = socketToRoomMap.get(socket.id);
    if (!roomId) return;

    const room = roomService.getRoom(roomId);
    if (!room) return;

    const leavingParticipant = room.participants[socket.id];
    if (leavingParticipant) {
      console.log(`[LEAVING ROOM]: User "${leavingParticipant.username}" left room "${roomId}"`);
      
      // Remove participant from room database
      const updatedRoom = roomService.leaveRoom(roomId, socket.id);
      socketToRoomMap.delete(socket.id);
      socket.leave(roomId);

      // Notify the remaining participants in the room
      io.to(roomId).emit('user-left', {
        socketId: socket.id,
        username: leavingParticipant.username,
        newHostId: updatedRoom ? updatedRoom.hostId : null,
      });
    }
  };
};
