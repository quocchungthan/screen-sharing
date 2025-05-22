// services/webrtc.ts
import { logCBT } from './logger';
import { socketClient } from './socket-boundary';

export interface IWebRTCClient {
  startMicrophone(): Promise<void>;
  stopMicrophone(): void;
  startScreenShare(): Promise<void>;
  stopScreenShare(): void;
  connectToPeer(peerId: string): void;
  disconnectFromPeer(peerId: string): void;
  disconnectAll(): void;
}

class WebRTCClient implements IWebRTCClient {
  private peers = new Map<string, RTCPeerConnection>();
  private localMicStream: MediaStream | null = null;
  private localScreenStream: MediaStream | null = null;

  private iceConfig: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  async startMicrophone() {
    logCBT('startMicrophone called');
    if (!this.localMicStream) {
      this.localMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      logCBT('Microphone stream started');
      this.broadcastTracks(this.localMicStream);
    }
  }

  stopMicrophone() {
    logCBT('stopMicrophone called');
    this.localMicStream?.getTracks().forEach(track => track.stop());
    this.localMicStream = null;
    this.removeTracksByKind('audio');
    logCBT('Microphone stream stopped and tracks removed');
  }

  async startScreenShare() {
    logCBT('startScreenShare called');
    if (!this.localScreenStream) {
      this.localScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      logCBT('Screen share stream started');
      this.broadcastTracks(this.localScreenStream);
    }
  }

  stopScreenShare() {
    logCBT('stopScreenShare called');
    this.localScreenStream?.getTracks().forEach(track => track.stop());
    this.localScreenStream = null;
    this.removeTracksByKind('video');
    logCBT('Screen share stream stopped and tracks removed');
  }

  connectToPeer(peerId: string) {
    logCBT(`connectToPeer called for peerId: ${peerId}`);
    if (this.peers.has(peerId)) {
      logCBT(`Already connected to peer ${peerId}`);
      return;
    }

    const pc = new RTCPeerConnection(this.iceConfig);
    this.peers.set(peerId, pc);

    const streamTracks = [...(this.localMicStream?.getTracks() || []), ...(this.localScreenStream?.getTracks() || [])];
    streamTracks.forEach(track => pc.addTrack(track));
    logCBT(`Tracks added to peer connection for peerId: ${peerId}`);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketClient.emit('ICE_CANDIDATE', { to: peerId, candidate: e.candidate });
        logCBT(`ICE candidate sent to ${peerId}`);
      }
    };

    pc.onnegotiationneeded = async () => {
      logCBT(`Negotiation needed for peerId: ${peerId}`);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketClient.emit('OFFER', { to: peerId, offer });
      logCBT(`Offer sent to peerId: ${peerId}`);
    };
  }

  disconnectFromPeer(peerId: string) {
    logCBT(`disconnectFromPeer called for peerId: ${peerId}`);
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
      logCBT(`Disconnected from peerId: ${peerId}`);
    }
  }

  disconnectAll() {
    logCBT('disconnectAll called');
    this.peers.forEach((pc, peerId) => {
      pc.close();
      logCBT(`Closed connection to peerId: ${peerId}`);
    });
    this.peers.clear();
    this.stopMicrophone();
    this.stopScreenShare();
    logCBT('All peers disconnected and local streams stopped');
  }

  private broadcastTracks(stream: MediaStream) {
    logCBT(`Broadcasting ${stream.getTracks().length} tracks to all peers`);
    for (const [, pc] of this.peers) {
      stream.getTracks().forEach(track => pc.addTrack(track));
    }
  }

  private removeTracksByKind(kind: 'audio' | 'video') {
    logCBT(`Removing tracks of kind: ${kind}`);
    for (const [, pc] of this.peers) {
      const senders = pc.getSenders();
      senders
        .filter(sender => sender.track?.kind === kind)
        .forEach(sender => pc.removeTrack(sender));
    }
  }
}


// Export instance and interface
export const webrtcClient: IWebRTCClient = new WebRTCClient();
