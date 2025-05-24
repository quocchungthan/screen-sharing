// services/webrtc.ts
import { logCBT } from "./logger";
import { clientId, socketClient } from "./socket-boundary";

export interface IWebRTCClient {
	getPeer(from: string): RTCPeerConnection | undefined;
	startMicrophone(): Promise<void>;
	stopMicrophone(): void;
	startScreenShare(): Promise<void>;
	stopScreenShare(): void;
	connectToPeer(peerId: string): RTCPeerConnection;
	disconnectFromPeer(peerId: string): void;
	disconnectAll(): void;
}

class WebRTCClient implements IWebRTCClient {
	private peers = new Map<string, RTCPeerConnection>();
	private localMicStream: MediaStream | null = null;
	private localScreenStream: MediaStream | null = null;
	private audioElements = new Map<string, HTMLAudioElement>();
	private pendingCandidates = new Map<string, RTCIceCandidate[]>();

	private iceConfig: RTCConfiguration = {
		iceServers: [
			{ urls: "stun:stun.l.google.com:19302" },
			{ urls: "stun:stun1.l.google.com:19302" },
			{ urls: "stun:stun2.l.google.com:19302" },
		],
	};

	async startMicrophone() {
		logCBT("startMicrophone called");
		try {
			this.localMicStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});
			logCBT("Microphone stream started");
			
			// Add tracks to all existing peer connections
			this.peers.forEach((peer) => {
				if (this.localMicStream) {
					const tracks = this.localMicStream.getTracks();
					tracks.forEach((track) => {
						peer.addTrack(track, this.localMicStream!);
					});
				}
			});
		} catch (error) {
			logCBT("Error starting microphone:", error);
			throw error;
		}
	}

	stopMicrophone() {
		logCBT("stopMicrophone called");
		if (this.localMicStream) {
			this.localMicStream.getTracks().forEach((track) => {
				track.stop();
				// Remove tracks from all peer connections
				this.peers.forEach((peer) => {
					const senders = peer.getSenders();
					const sender = senders.find((s) => s.track === track);
					if (sender) {
						peer.removeTrack(sender);
					}
				});
			});
			this.localMicStream = null;
		}
		logCBT("Microphone stream stopped");
	}

	async startScreenShare() {
		logCBT("startScreenShare called");
		try {
			this.localScreenStream = await navigator.mediaDevices.getDisplayMedia({
				video: {
					width: { ideal: 1920 },
					height: { ideal: 1080 },
					frameRate: { ideal: 30 },
				},
				audio: true,
			});
			logCBT("Screen share stream started");
			
			// Add tracks to all existing peer connections
			this.peers.forEach((peer) => {
				if (this.localScreenStream) {
					const tracks = this.localScreenStream.getTracks();
					tracks.forEach((track) => {
						peer.addTrack(track, this.localScreenStream!);
					});
				}
			});
		} catch (error) {
			logCBT("Error starting screen share:", error);
			throw error;
		}
	}

	stopScreenShare() {
		logCBT("stopScreenShare called");
		if (this.localScreenStream) {
			this.localScreenStream.getTracks().forEach((track) => {
				track.stop();
				// Remove tracks from all peer connections
				this.peers.forEach((peer) => {
					const senders = peer.getSenders();
					const sender = senders.find((s) => s.track === track);
					if (sender) {
						peer.removeTrack(sender);
					}
				});
			});
			this.localScreenStream = null;
		}
		logCBT("Screen share stream stopped");
	}

	connectToPeer(peerId: string) {
		logCBT(`connectToPeer called for peerId: ${peerId}`);
		if (this.peers.has(peerId)) {
			logCBT(`Already connected to peer ${peerId}`);
			return this.peers.get(peerId)!;
		}

		const pc = new RTCPeerConnection(this.iceConfig);
		this.peers.set(peerId, pc);

		// Add existing tracks to the new peer connection
		if (this.localMicStream) {
			this.localMicStream.getTracks().forEach((track) => {
				pc.addTrack(track, this.localMicStream!);
			});
		}

		if (this.localScreenStream) {
			this.localScreenStream.getTracks().forEach((track) => {
				pc.addTrack(track, this.localScreenStream!);
			});
		}

		pc.onicecandidate = (e) => {
			if (e.candidate) {
				if (pc.remoteDescription) {
					socketClient.emit("ICE_CANDIDATE", {
						to: peerId,
						candidate: e.candidate,
					});
					logCBT(`ICE candidate sent to ${peerId}`);
				} else {
					// Store candidate if remote description is not set yet
					const candidates = this.pendingCandidates.get(peerId) || [];
					candidates.push(e.candidate);
					this.pendingCandidates.set(peerId, candidates);
					logCBT(`Stored pending ICE candidate for ${peerId}`);
				}
			}
		};

		pc.ontrack = (event) => {
			logCBT(`Received remote track from ${peerId}, kind: ${event.track.kind}`);
			
			if (event.track.kind === "audio") {
				// Create or get existing audio element for this peer
				let audioEl = this.audioElements.get(peerId);
				if (!audioEl) {
					audioEl = new Audio();
					audioEl.autoplay = true;
					document.body.appendChild(audioEl);
					this.audioElements.set(peerId, audioEl);
				}

				// Create a new MediaStream for this track
				const stream = new MediaStream([event.track]);
				audioEl.srcObject = stream;
				
				// Handle track ended event
				event.track.onended = () => {
					if (audioEl) {
						audioEl.srcObject = null;
						audioEl.remove();
						this.audioElements.delete(peerId);
					}
				};
			}
		};

		pc.onnegotiationneeded = async () => {
			try {
				logCBT(`Negotiation needed for peerId: ${peerId}`);
				const offer = await pc.createOffer();
				await pc.setLocalDescription(offer);
				socketClient.emit("OFFER", { to: peerId, offer, from: clientId });
				logCBT(`Offer sent to peerId: ${peerId}`);
			} catch (error) {
				logCBT("Error during negotiation:", error);
			}
		};

		return pc;
	}

	async handleRemoteDescription(peerId: string, description: RTCSessionDescriptionInit) {
		const pc = this.getPeer(peerId);
		if (!pc) return;

		try {
			await pc.setRemoteDescription(description);
			logCBT(`Set remote description for ${peerId}`);

			// Add any pending candidates
			const candidates = this.pendingCandidates.get(peerId);
			if (candidates) {
				for (const candidate of candidates) {
					await pc.addIceCandidate(candidate);
					logCBT(`Added pending ICE candidate for ${peerId}`);
				}
				this.pendingCandidates.delete(peerId);
			}
		} catch (error) {
			logCBT(`Error setting remote description for ${peerId}:`, error);
		}
	}

	disconnectFromPeer(peerId: string) {
		logCBT(`disconnectFromPeer called for peerId: ${peerId}`);
		const pc = this.peers.get(peerId);
		if (pc) {
			pc.close();
			this.peers.delete(peerId);
			this.pendingCandidates.delete(peerId);
			
			// Clean up audio element
			const audioEl = this.audioElements.get(peerId);
			if (audioEl) {
				audioEl.srcObject = null;
				audioEl.remove();
				this.audioElements.delete(peerId);
			}
			
			logCBT(`Disconnected from peerId: ${peerId}`);
		}
	}

	getPeer(from: string) {
		return this.peers.get(from);
	}

	disconnectAll() {
		logCBT("disconnectAll called");
		this.peers.forEach((pc, peerId) => {
			pc.close();
			
			// Clean up audio elements
			const audioEl = this.audioElements.get(peerId);
			if (audioEl) {
				audioEl.srcObject = null;
				audioEl.remove();
				this.audioElements.delete(peerId);
			}
			
			logCBT(`Closed connection to peerId: ${peerId}`);
		});
		this.peers.clear();
		this.pendingCandidates.clear();
		this.stopMicrophone();
		this.stopScreenShare();
		logCBT("All peers disconnected and local streams stopped");
	}
}

// Export instance and interface
export const webrtcClient: IWebRTCClient = new WebRTCClient();