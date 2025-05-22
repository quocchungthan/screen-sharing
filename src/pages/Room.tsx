import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Share2, StopCircle, Users, X, UserCheck } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useRoomStore } from '../store/roomStore';
import { initializeSocketEvents, disconnect } from '../services/socket';
import { 
  initializeMedia, 
  toggleMicrophone, 
  startScreenShare, 
  stopScreenShare, 
  cleanup 
} from '../services/webrtc';
import ParticipantsList from '../components/ParticipantsList';

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { username, isMuted, toggleMute, isSharing, setSharing } = useUserStore();
  const { participants, setRoomId } = useRoomStore();
  const [showParticipants, setShowParticipants] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Initialize room and WebRTC
  useEffect(() => {
    if (!roomId || !username) {
      navigate('/');
      return;
    }
    
    setRoomId(roomId);
    
    const init = async () => {
      try {
        // Initialize socket connection
        initializeSocketEvents(username);
        
        // Initialize local media
        await initializeMedia(roomId, !isMuted);
        
        setIsInitializing(false);
      } catch (err) {
        console.error('Error initializing room:', err);
        setError('Could not access microphone. Please check permissions and try again.');
        setIsInitializing(false);
      }
    };
    
    init();
    
    // Clean up when component unmounts
    return () => {
      cleanup();
      disconnect();
    };
  }, [roomId, username, navigate, setRoomId, isMuted]);
  
  // Handle mute/unmute
  const handleToggleMute = () => {
    toggleMute();
    toggleMicrophone(!isMuted);
  };
  
  // Handle screen sharing
  const handleToggleScreenShare = async () => {
    try {
      if (isSharing) {
        stopScreenShare();
        setSharing(false);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      } else {
        const stream = await startScreenShare();
        setSharing(true);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
          };
        }
      }
    } catch (err) {
      console.error('Error toggling screen share:', err);
      setError('Could not start screen sharing. Please check permissions and try again.');
    }
  };
  
  // Handle leave room
  const handleLeaveRoom = () => {
    cleanup();
    disconnect();
    navigate('/');
  };
  
  // Show/hide controls on mouse movement
  const handleMouseMove = () => {
    setControlsVisible(true);
    
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    
    controlsTimeout.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  };
  
  // Set up mouse move listener
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);
  
  // Get the current sharing participant
  const sharingParticipant = participants.find(p => p.isSharing);
  
  return (
    <div 
      className="min-h-screen bg-gray-900 flex flex-col"
      onMouseMove={handleMouseMove}
    >
      {/* Header */}
      <header className="bg-gray-800 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-white">ScreenShare</h1>
          <div className="ml-4 px-3 py-1 bg-blue-600 rounded-full text-sm font-medium">
            Room: {roomId}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            className="btn-secondary flex items-center"
            onClick={() => setShowParticipants(!showParticipants)}
          >
            <Users size={18} className="mr-2" />
            Participants ({participants.length})
          </button>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex relative overflow-hidden">
        {/* Video display area */}
        <div className="flex-1 flex items-center justify-center bg-black">
          {isInitializing ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Initializing room...</p>
            </div>
          ) : error ? (
            <div className="text-center max-w-md mx-auto p-6 bg-gray-800 rounded-lg">
              <div className="text-red-500 mb-4">
                <X size={48} className="mx-auto" />
              </div>
              <h2 className="text-xl font-bold mb-2">Error</h2>
              <p className="text-gray-400 mb-4">{error}</p>
              <button className="btn-primary" onClick={() => navigate('/')}>
                Return to Home
              </button>
            </div>
          ) : isSharing || sharingParticipant ? (
            <div className="screen-container w-full h-full max-w-full max-h-full">
              {isSharing ? (
                <video 
                  ref={videoRef} 
                  className="w-full h-full object-contain" 
                  autoPlay 
                  playsInline
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xl">
                    {sharingParticipant?.username} is sharing their screen
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center max-w-md mx-auto p-6 bg-gray-800 rounded-lg">
              <Share2 size={48} className="mx-auto mb-4 text-blue-500" />
              <h2 className="text-xl font-bold mb-2">No Active Screen Share</h2>
              <p className="text-gray-400 mb-4">
                Share your screen or wait for another participant to share.
              </p>
              <button className="btn-primary" onClick={handleToggleScreenShare}>
                Share Your Screen
              </button>
            </div>
          )}
        </div>
        
        {/* Participants sidebar */}
        {showParticipants && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 animate-slide-right">
            <ParticipantsList 
              onClose={() => setShowParticipants(false)} 
            />
          </div>
        )}
      </main>
      
      {/* Control bar */}
      <div className={`control-bar ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button 
              className={`btn rounded-full p-3 ${isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              onClick={handleToggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <MicOff size={20} />
              ) : (
                <Mic size={20} />
              )}
            </button>
            
            <button 
              className={`btn rounded-full p-3 ${isSharing ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              onClick={handleToggleScreenShare}
              title={isSharing ? 'Stop Sharing' : 'Share Screen'}
              disabled={!isSharing && !!sharingParticipant}
            >
              {isSharing ? (
                <StopCircle size={20} />
              ) : (
                <Share2 size={20} />
              )}
            </button>
          </div>
          
          <div className="flex items-center">
            <button 
              className="btn-danger"
              onClick={handleLeaveRoom}
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;