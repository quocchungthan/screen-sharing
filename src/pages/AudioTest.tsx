import React, { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { webrtcClient } from '../services/webrtc';
import { socketClient, clientId } from '../services/socket-boundary';
import { useUserStore } from '../store/userStore';

const AudioTest: React.FC = () => {
  const [localMuted, setLocalMuted] = useState(true);
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('');
  const { username } = useUserStore();

  useEffect(() => {
    // Initialize audio
    const initAudio = async () => {
      try {
        await webrtcClient.startMicrophone();
        setConnectionStatus('Microphone initialized');
        
        // Listen for remote peer connection
        socketClient.listen<{ clientId: string; username: string }>('USER_JOINED')
          .subscribe(({ clientId: peerId }) => {
            if (peerId !== clientId) {
              setRemotePeerId(peerId);
              setConnectionStatus('Remote peer joined');
              webrtcClient.connectToPeer(peerId);
            }
          });
      } catch (err) {
        setConnectionStatus('Failed to initialize microphone');
        console.error(err);
      }
    };

    initAudio();
    
    // Join test room
    socketClient.enterRoom('audio-test');
    socketClient.emit('USER_JOINED', { 
      clientId,
      username: username || 'Test User',
      isMuted: localMuted,
      isSharing: false
    });

    return () => {
      webrtcClient.disconnectAll();
    };
  }, [username, localMuted]);

  const toggleMute = () => {
    setLocalMuted(!localMuted);
    if (localMuted) {
      webrtcClient.startMicrophone();
    } else {
      webrtcClient.stopMicrophone();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-6">Audio Test</h1>
        
        <div className="space-y-4">
          <div className="bg-gray-700 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-2">Local Audio</h2>
            <button
              onClick={toggleMute}
              className={`btn rounded-full p-3 ${
                localMuted
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {localMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          </div>

          <div className="bg-gray-700 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-2">Connection Status</h2>
            <p className="text-gray-300">{connectionStatus}</p>
            {remotePeerId && (
              <p className="text-gray-300 mt-2">Connected to: {remotePeerId}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioTest;