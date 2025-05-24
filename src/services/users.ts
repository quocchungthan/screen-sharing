import { socketClient, clientId } from "./socket-boundary";
import { useUserStore } from "../store/userStore";
import { Participant, useRoomStore } from "../store/roomStore";
import { logCBT } from "./logger";
import { webrtcClient } from "./webrtc";

// Define event names
const EVENTS = {
	USER_JOINED: "USER_JOINED",
	USER_LEFT: "USER_LEFT",
	TOGGLE_MUTE: "TOGGLE_MUTE",
	TOGGLE_SHARING: "TOGGLE_SHARING",
	ROOM_PARTICIPANTS: "ROOM_PARTICIPANTS", // ✅ New event
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
	logCBT("leaveRoom called");
	socketClient.emit<{ clientId: string }>(EVENTS.USER_LEFT, { clientId });
	logCBT(`Emitted USER_LEFT for clientId: ${clientId}`);

	useUserStore.getState().reset();
	useRoomStore.getState().reset();
	logCBT("User and Room stores reset");
}

export function toggleMute() {
	logCBT("toggleMute called");
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
	logCBT("toggleSharing called");
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
	logCBT("Setting up user listeners");

	socketClient
		.listen<UserEvent>(EVENTS.USER_JOINED)
		.subscribe(({ clientId: id, username, isMuted, isSharing }) => {
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

			// 💬 Initiate WebRTC connection
			webrtcClient.connectToPeer(id);

			// ✅ Send current participants to the new user
			const participants = useRoomStore.getState().participants;
			socketClient.emit<{
				targetClientId: string;
				participants: Participant[];
			}>(EVENTS.ROOM_PARTICIPANTS, {
				targetClientId: id,
				participants,
			});
			logCBT(`Sent ROOM_PARTICIPANTS to ${id}`);
		});

	socketClient
		.listen<{ targetClientId: string; participants: Participant[] }>(
			EVENTS.ROOM_PARTICIPANTS
		)
		.subscribe(({ targetClientId, participants }) => {
			if (targetClientId !== clientId) return;
			logCBT(`Received ROOM_PARTICIPANTS: ${JSON.stringify(participants)}`);
			useRoomStore.getState().setParticipants(participants);

			// ☎️ Initiate connection to all existing peers
			participants.forEach((p) => {
				if (p.id !== clientId) {
					logCBT(`Connecting to existing peer ${p.id}`);
					webrtcClient.connectToPeer(p.id);
				}
			});
		});

	socketClient
		.listen<{ clientId: string }>(EVENTS.USER_LEFT)
		.subscribe(({ clientId: id }) => {
			logCBT(`Received USER_LEFT from ${id}`);
			useRoomStore.getState().removeParticipant(id);
			webrtcClient.disconnectFromPeer(id);
		});

	socketClient
		.listen<ToggleEvent>(EVENTS.TOGGLE_MUTE)
		.subscribe(({ clientId: id, value }) => {
			logCBT(`Received TOGGLE_MUTE from ${id}, value: ${value}`);
			useRoomStore.getState().updateParticipant(id, { isMuted: value });
		});

	socketClient
		.listen<ToggleEvent>(EVENTS.TOGGLE_SHARING)
		.subscribe(({ clientId: id, value }) => {
			logCBT(`Received TOGGLE_SHARING from ${id}, value: ${value}`);
			useRoomStore.getState().updateParticipant(id, { isSharing: value });
		});

	// ---- WebRTC Signaling ----

	socketClient
		.listen<{ from: string; offer: RTCSessionDescriptionInit }>("OFFER")
		.subscribe(async ({ from, offer }) => {
			logCBT(`Received OFFER from ${from}`);
			const pc = webrtcClient.getPeer(from) || webrtcClient.connectToPeer(from);
			await pc.setRemoteDescription(new RTCSessionDescription(offer));
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);
			socketClient.emit("ANSWER", { to: from, answer });
			logCBT(`Sent ANSWER to ${from}`);
		});

	socketClient
		.listen<{ from: string; answer: RTCSessionDescriptionInit }>("ANSWER")
		.subscribe(async ({ from, answer }) => {
			logCBT(`Received ANSWER from ${from}`);
			const pc = webrtcClient.getPeer(from);
			if (pc) {
				await pc.setRemoteDescription(new RTCSessionDescription(answer));
			}
		});

	socketClient
		.listen<{ from: string; candidate: RTCIceCandidateInit }>("ICE_CANDIDATE")
		.subscribe(async ({ from, candidate }) => {
			logCBT(`Received ICE_CANDIDATE from ${from}`);
			const pc = webrtcClient.getPeer(from);
			if (pc) {
				await pc.addIceCandidate(new RTCIceCandidate(candidate));
			}
		});
}
