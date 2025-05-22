import { useState, useCallback, useRef, useEffect } from 'react';

interface UseScreenShareReturn {
  screenStream: MediaStream | null;
  isSharing: boolean;
  startSharing: () => Promise<void>;
  stopSharing: () => void;
  error: string | null;
}

export const useScreenShare = (): UseScreenShareReturn => {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Keep a ref to the stream for cleanup
  const streamRef = useRef<MediaStream | null>(null);
  
  // Start screen sharing
  const startSharing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });
      
      streamRef.current = stream;
      setScreenStream(stream);
      setIsSharing(true);
      setError(null);
      
      // Handle case when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };
    } catch (err) {
      console.error('Error starting screen share:', err);
      setError('Failed to start screen sharing. Please check permissions and try again.');
    }
  }, []);
  
  // Stop screen sharing
  const stopSharing = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setScreenStream(null);
      setIsSharing(false);
    }
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  return {
    screenStream,
    isSharing,
    startSharing,
    stopSharing,
    error
  };
};