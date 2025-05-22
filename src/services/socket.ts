/* eslint-disable @typescript-eslint/no-unused-vars */
import { io } from 'socket.io-client';
import { useRoomStore, Participant } from '../store/roomStore';
import { v4 as uuidv4 } from 'uuid';
import SimplePeer from 'simple-peer';

// We would replace this with the actual server URL in production
const SERVER_URL = 'http://localhost:3000';

// For development, we'll simulate the socket connection
const MOCK_MODE = true;

// Create a UUID for this client
const clientId = uuidv4();

// Initialize socket
export const socket = io(SERVER_URL);

// Set up socket event listeners
export const initializeSocketEvents = (username: string): string => {
  // Join or create a room
  const roomId = window.location.pathname.split('/room/')[1] || uuidv4();
  
  // Join room
  socket.emit('join-room', { roomId, username, userId: clientId });
  
  // Listen for other users in the room
  socket.on('room-users', ({ users }: { users: Participant[] }) => {
    users.forEach(user => {
      useRoomStore.getState().addParticipant(user);
    });
  });
  
  // Listen for new user joining
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on('user-joined', ({ user }: { user: Participant, signal: any }) => {
    useRoomStore.getState().addParticipant(user);
    
    // If this is a real WebRTC connection (not mock)
    if (!MOCK_MODE && 'signal' in user) {
      addPeer(user.id, user.signal);
    }
  });
  
  // Listen for WebRTC signaling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on('signal', ({ userId, signal }: { userId: string, signal: any }) => {
    signalPeer(userId, signal);
  });
  
  // Listen for user mute changes
  socket.on('user-mute-update', ({ userId, isMuted }: { userId: string, isMuted: boolean }) => {
    useRoomStore.getState().updateParticipant(userId, { isMuted });
  });
  
  // Listen for screen sharing status
  socket.on('screen-share-update', ({ userId, isSharing }: { userId: string, isSharing: boolean }) => {
    useRoomStore.getState().updateParticipant(userId, { isSharing });
  });
  
  // Listen for user leaving
  socket.on('user-left', ({ userId }: { userId: string }) => {
    useRoomStore.getState().removeParticipant(userId);
    removePeer(userId);
  });
  
  return roomId;
};

// Clean up socket connection
export const disconnect = (): void => {
  socket.disconnect();
};

interface PeerConnection {
  peer: SimplePeer.Instance;
  userId: string;
  stream?: MediaStream;
}

let localStream: MediaStream | null = null;
let screenStream: MediaStream | null = null;
let peers: Record<string, PeerConnection> = {};
let localUserId: string = '';

// Initialize local media
export const initializeMedia = async (userId: string, audio: boolean = true): Promise<MediaStream> => {
  try {
    localUserId = userId;
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: true,
      video: false
    });
    
    // Initial mute state
    localStream.getAudioTracks().forEach(track => {
      track.enabled = audio;
    });
    
    return localStream;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    throw error;
  }
};

// Toggle microphone
export const toggleMicrophone = (enabled: boolean): void => {
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });
    // Notify others about mute state change
    socket.emit('user-mute-change', { isMuted: !enabled });
  }
};

// Start screen sharing
export const startScreenShare = async (): Promise<MediaStream> => {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ 
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: true
    });
    
    // Notify peers about screen sharing
    socket.emit('screen-share-started');
    
    // When user stops sharing screen through browser UI
    screenStream.getVideoTracks()[0].onended = () => {
      stopScreenShare();
    };
    
    // Share the screen with all peers
    Object.values(peers).forEach(({ peer }) => {
      if (screenStream) {
        screenStream.getTracks().forEach(track => {
          peer.addTrack(track, screenStream as MediaStream);
        });
      }
    });
    
    return screenStream;
  } catch (error) {
    console.error('Error starting screen share:', error);
    throw error;
  }
};

// Stop screen sharing
export const stopScreenShare = (): void => {
  if (screenStream) {
    screenStream.getTracks().forEach(track => {
      track.stop();
    });
    
    // Notify peers that screen sharing has stopped
    socket.emit('screen-share-stopped');
    screenStream = null;
  }
};

// Create a new peer connection
export const createPeer = (userId: string, initiator: boolean): SimplePeer.Instance => {
  const peer = new SimplePeer({
    initiator,
    trickle: false,
    stream: localStream ?? undefined
  });
  
  peer.on('signal', signal => {
    socket.emit('signal', { userId, signal });
  });
  
  peer.on('stream', stream => {
    // Handle incoming stream
    const connectionInfo = peers[userId];
    if (connectionInfo) {
      connectionInfo.stream = stream;
    }
  });
  
  peers[userId] = { peer, userId };
  
  return peer;
};

// Add a new peer when a user joins
export const addPeer = (userId: string, signal: SimplePeer.SignalData): void => {
  const peer = createPeer(userId, false);
  peer.signal(signal);
};

// Signal an existing peer
export const signalPeer = (userId: string, signal: SimplePeer.SignalData): void => {
  if (peers[userId]) {
    peers[userId].peer.signal(signal);
  }
};

// Remove a peer when a user leaves
export const removePeer = (userId: string): void => {
  if (peers[userId]) {
    peers[userId].peer.destroy();
    delete peers[userId];
  }
};

// Get a stream by user ID
export const getStreamByUserId = (userId: string): MediaStream | undefined => {
  return peers[userId]?.stream;
};

// Clean up resources
export const cleanup = (): void => {
  if (localStream) {
    localStream.getTracks().forEach(track => {
      track.stop();
    });
    localStream = null;
  }
  
  if (screenStream) {
    screenStream.getTracks().forEach(track => {
      track.stop();
    });
    screenStream = null;
  }
  
  Object.values(peers).forEach(({ peer }) => {
    peer.destroy();
  });
  
  peers = {};
};