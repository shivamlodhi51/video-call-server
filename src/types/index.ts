export interface Participant {
  socketId: string;
  username: string;
  joinedAt: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

export interface Room {
  id: string;
  hostId: string;
  participants: Record<string, Participant>;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface SignalData {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: string;
  candidate?: any;
}

export interface SignalPayload {
  to: string;
  from: string;
  signal: SignalData;
}
