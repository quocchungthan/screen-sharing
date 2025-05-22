/* eslint-disable @typescript-eslint/no-unused-vars */
import Ably from 'ably';
import { useRoomStore, Participant } from '../store/roomStore';
import { v4 as uuidv4 } from 'uuid';
import SimplePeer from 'simple-peer';

// Replace this with your Ably API key (keep it secret in production)
const ABLY_API_KEY = 'muycWw._2-uwQ:Ss_mzKxyRbWd-YAJlYVu64PJuBHt3Pe9XU9mcLiRAOI';

// For development
const MOCK_MODE = true;

const clientId = uuidv4();
let ably: Ably.Realtime;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let channel: any;

interface PeerConnection {
  peer: SimplePeer.Instance;
  userId: string;
  stream?: MediaStream;
}

let localStream: MediaStream | null = null;
let screenStream: MediaStream | null = null;
let peers: Record<string, PeerConnection> = {};
let localUserId: string = '';

export const initializeSocketEvents = (username: string): string => {
  const roomId = window.location.pathname.split('/room/')[1] || uuidv4();

  ably = new Ably.Realtime({ key: ABLY_API_KEY, clientId });
  channel = ably.channels.get(`room-${roomId}`);

  // Notify about joining
  channel.publish('join-room', { userId: clientId, username });

  // Subscribe to users list
  channel.subscribe('room-users', (msg) => {
    const { users } = msg.data as { users: Participant[] };
    users.forEach(user => {
      useRoomStore.getState().addParticipant(user);
    });
  });

  channel.subscribe('user-joined', (msg) => {
    const { user, signal } = msg.data as { user: Participant, signal: any };
    useRoomStore.getState().addParticipant(user);

    if (!MOCK_MODE && signal) {
      addPeer(user.id, signal);
    }
  });

  channel.subscribe('signal', (msg) => {
    const { userId, signal } = msg.data;
    signalPeer(userId, signal);
  });

  channel.subscribe('user-mute-update', (msg) => {
    const { userId, isMuted } = msg.data;
    useRoomStore.getState().updateParticipant(userId, { isMuted });
  });

  channel.subscribe('screen-share-update', (msg) => {
    const { userId, isSharing } = msg.data;
    useRoomStore.getState().updateParticipant(userId, { isSharing });
  });

  channel.subscribe('user-left', (msg) => {
    const { userId } = msg.data;
    useRoomStore.getState().removeParticipant(userId);
    removePeer(userId);
  });

  return roomId;
};

export const disconnect = (): void => {
  ably?.close();
};

export const initializeMedia = async (userId: string, audio = true): Promise<MediaStream> => {
  try {
    localUserId = userId;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    localStream.getAudioTracks().forEach(track => {
      track.enabled = audio;
    });

    return localStream;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    throw error;
  }
};

export const toggleMicrophone = (enabled: boolean): void => {
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });
    channel.publish('user-mute-change', { userId: clientId, isMuted: !enabled });
  }
};

export const startScreenShare = async (): Promise<MediaStream> => {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
      audio: true
    });

    channel.publish('screen-share-started', { userId: clientId });

    screenStream.getVideoTracks()[0].onended = () => {
      stopScreenShare();
    };

    Object.values(peers).forEach(({ peer }) => {
      screenStream!.getTracks().forEach(track => {
        peer.addTrack(track, screenStream as MediaStream);
      });
    });

    return screenStream;
  } catch (error) {
    console.error('Error starting screen share:', error);
    throw error;
  }
};

export const stopScreenShare = (): void => {
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    channel.publish('screen-share-stopped', { userId: clientId });
    screenStream = null;
  }
};

export const createPeer = (userId: string, initiator: boolean): SimplePeer.Instance => {
  const peer = new SimplePeer({
    initiator,
    trickle: false,
    stream: localStream ?? undefined
  });

  peer.on('signal', signal => {
    channel.publish('signal', { userId, signal });
  });

  peer.on('stream', stream => {
    const connectionInfo = peers[userId];
    if (connectionInfo) {
      connectionInfo.stream = stream;
    }
  });

  peers[userId] = { peer, userId };
  return peer;
};

export const addPeer = (userId: string, signal: SimplePeer.SignalData): void => {
  const peer = createPeer(userId, false);
  peer.signal(signal);
};

export const signalPeer = (userId: string, signal: SimplePeer.SignalData): void => {
  if (peers[userId]) {
    peers[userId].peer.signal(signal);
  }
};

export const removePeer = (userId: string): void => {
  if (peers[userId]) {
    peers[userId].peer.destroy();
    delete peers[userId];
  }
};

export const getStreamByUserId = (userId: string): MediaStream | undefined => {
  return peers[userId]?.stream;
};

export const cleanup = (): void => {
  localStream?.getTracks().forEach(track => track.stop());
  screenStream?.getTracks().forEach(track => track.stop());

  localStream = null;
  screenStream = null;

  Object.values(peers).forEach(({ peer }) => peer.destroy());
  peers = {};
};
