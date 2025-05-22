import { useState, useCallback, useRef, useEffect } from 'react';

interface UseAudioReturn {
  audioStream: MediaStream | null;
  isMuted: boolean;
  toggleMute: () => void;
  setMute: (muted: boolean) => void;
  error: string | null;
}

export const useAudio = (): UseAudioReturn => {
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Keep a ref to the stream for cleanup
  const streamRef = useRef<MediaStream | null>(null);
  
  // Initialize audio on mount
  useEffect(() => {
    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
        
        // Initialize as muted
        stream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
        
        streamRef.current = stream;
        setAudioStream(stream);
        setError(null);
      } catch (err) {
        console.error('Error initializing audio:', err);
        setError('Could not access microphone. Please check permissions and try again.');
      }
    };
    
    initAudio();
    
    // Clean up on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Toggle mute state
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const newMuteState = !isMuted;
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = newMuteState;
      });
      setIsMuted(!newMuteState);
    }
  }, [isMuted]);
  
  // Set specific mute state
  const setMute = useCallback((muted: boolean) => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
      setIsMuted(muted);
    }
  }, []);
  
  return {
    audioStream,
    isMuted,
    toggleMute,
    setMute,
    error
  };
};