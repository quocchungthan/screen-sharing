import { io } from 'socket.io-client';
import { useRoomStore, Participant } from '../store/roomStore';
import { v4 as uuidv4 } from 'uuid';
import { addPeer, signalPeer, removePeer } from './webrtc';

// We would replace this with the actual server URL in production
const SERVER_URL = 'https://your-signaling-server.com';

// For development, we'll simulate the socket connection
const MOCK_MODE = true;

// Create a UUID for this client
const clientId = uuidv4();

// Initialize socket
export const socket = MOCK_MODE 
  ? mockSocket() 
  : io(SERVER_URL);

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
  socket.on('user-joined', ({ user }: { user: Participant, signal: any }) => {
    useRoomStore.getState().addParticipant(user);
    
    // If this is a real WebRTC connection (not mock)
    if (!MOCK_MODE && 'signal' in user) {
      addPeer(user.id, user.signal);
    }
  });
  
  // Listen for WebRTC signaling
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

// Mock socket implementation for development
function mockSocket() {
  const mockParticipants: Participant[] = [
    { id: 'user1', username: 'Alice', isMuted: false, isSharing: false },
    { id: 'user2', username: 'Bob', isMuted: true, isSharing: false },
    { id: 'user3', username: 'Charlie', isMuted: false, isSharing: false }
  ];
  
  const events: Record<string, Array<(data: any) => void>> = {};
  
  const mockSocket = {
    id: clientId,
    
    on: (event: string, callback: (data: any) => void) => {
      if (!events[event]) {
        events[event] = [];
      }
      events[event].push(callback);
      
      // Simulate receiving room users after joining
      if (event === 'room-users') {
        setTimeout(() => {
          callback({ users: mockParticipants });
        }, 1000);
      }
    },
    
    emit: (event: string, data: any) => {
      console.log(`Mock socket emitting: ${event}`, data);
      
      if (event === 'join-room') {
        // Add the current user to the mock room
        const currentUser: Participant = {
          id: clientId,
          username: data.username,
          isMuted: true,
          isSharing: false
        };
        
        // Notify others in the room about the new user
        setTimeout(() => {
          if (events['user-joined']) {
            events['user-joined'].forEach(cb => cb({ user: currentUser }));
          }
        }, 1500);
      }
      
      if (event === 'user-mute-change') {
        // Update the user's mute status
        setTimeout(() => {
          if (events['user-mute-update']) {
            events['user-mute-update'].forEach(cb => 
              cb({ userId: clientId, isMuted: data.isMuted })
            );
          }
        }, 300);
      }
      
      if (event === 'screen-share-started') {
        // Notify that screen sharing has started
        setTimeout(() => {
          if (events['screen-share-update']) {
            events['screen-share-update'].forEach(cb => 
              cb({ userId: clientId, isSharing: true })
            );
          }
        }, 300);
      }
      
      if (event === 'screen-share-stopped') {
        // Notify that screen sharing has stopped
        setTimeout(() => {
          if (events['screen-share-update']) {
            events['screen-share-update'].forEach(cb => 
              cb({ userId: clientId, isSharing: false })
            );
          }
        }, 300);
      }
    },
    
    disconnect: () => {
      console.log('Mock socket disconnected');
    }
  };
  
  return mockSocket as any;
}