import { socketClient, clientId } from './socket-boundary';
import { useUserStore } from '../store/userStore';
import { useRoomStore } from '../store/roomStore';
import { logCBT } from './logger';

// Define event names
const EVENTS = {
  USER_JOINED: 'USER_JOINED',
  USER_LEFT: 'USER_LEFT',
  TOGGLE_MUTE: 'TOGGLE_MUTE',
  TOGGLE_SHARING: 'TOGGLE_SHARING',
};

// Event Payloads
interface UserEvent {
  clientId: string;
  username: string;
  isMuted: boolean;
  isSharing: boolean;
}

interface ToggleEvent {
  clientId: string;
  value: boolean;
}

// ---- Emitters ----

export function joinRoom(roomId: string, username: string) {
  logCBT(`joinRoom called with roomId=${roomId}, username=${username}`);
  useRoomStore.getState().setRoomId(roomId);
  useUserStore.getState().setUsername(username);

  const isMuted = useUserStore.getState().isMuted;
  const isSharing = useUserStore.getState().isSharing;

  const payload: UserEvent = {
    clientId,
    username,
    isMuted,
    isSharing,
  };

  socketClient.emit<UserEvent>(EVENTS.USER_JOINED, payload);
  logCBT(`Emitted USER_JOINED with payload: ${JSON.stringify(payload)}`);

  useRoomStore.getState().addParticipant({
    id: clientId,
    username,
    isMuted,
    isSharing,
    signal: null,
  });
  logCBT(`Added self to room store: ${clientId}`);
}

export function leaveRoom() {
  logCBT('leaveRoom called');
  socketClient.emit<{ clientId: string }>(EVENTS.USER_LEFT, { clientId });
  logCBT(`Emitted USER_LEFT for clientId: ${clientId}`);

  useUserStore.getState().reset();
  useRoomStore.getState().reset();
  logCBT('User and Room stores reset');
}

export function toggleMute() {
  logCBT('toggleMute called');
  useUserStore.getState().toggleMute();
  const isMuted = useUserStore.getState().isMuted;

  socketClient.emit<ToggleEvent>(EVENTS.TOGGLE_MUTE, {
    clientId,
    value: isMuted,
  });
  logCBT(`Emitted TOGGLE_MUTE: ${isMuted}`);

  useRoomStore.getState().updateParticipant(clientId, { isMuted });
  logCBT(`Updated isMuted for ${clientId} in room store`);
}

export function toggleSharing() {
  logCBT('toggleSharing called');
  const next = !useUserStore.getState().isSharing;
  useUserStore.getState().setSharing(next);

  socketClient.emit<ToggleEvent>(EVENTS.TOGGLE_SHARING, {
    clientId,
    value: next,
  });
  logCBT(`Emitted TOGGLE_SHARING: ${next}`);

  useRoomStore.getState().updateParticipant(clientId, { isSharing: next });
  logCBT(`Updated isSharing for ${clientId} in room store`);
}

// ---- Listeners ----

export function setupUserListeners() {
  logCBT('Setting up user listeners');

  socketClient.listen<UserEvent>(EVENTS.USER_JOINED).subscribe(({ clientId: id, username, isMuted, isSharing }) => {
    if (id === clientId) return;
    logCBT(`Received USER_JOINED from ${id}`);

    useRoomStore.getState().addParticipant({
      id,
      username,
      isMuted,
      isSharing,
      signal: null,
    });
    logCBT(`Added participant ${id} to room`);
  });

  socketClient.listen<{ clientId: string }>(EVENTS.USER_LEFT).subscribe(({ clientId: id }) => {
    logCBT(`Received USER_LEFT from ${id}`);
    useRoomStore.getState().removeParticipant(id);
    logCBT(`Removed participant ${id} from room`);
  });

  socketClient.listen<ToggleEvent>(EVENTS.TOGGLE_MUTE).subscribe(({ clientId: id, value }) => {
    logCBT(`Received TOGGLE_MUTE from ${id}, value: ${value}`);
    useRoomStore.getState().updateParticipant(id, { isMuted: value });
  });

  socketClient.listen<ToggleEvent>(EVENTS.TOGGLE_SHARING).subscribe(({ clientId: id, value }) => {
    logCBT(`Received TOGGLE_SHARING from ${id}, value: ${value}`);
    useRoomStore.getState().updateParticipant(id, { isSharing: value });
  });
}
