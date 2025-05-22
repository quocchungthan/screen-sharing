import { create } from 'zustand';

export interface Participant {
  id: string;
  username: string;
  isMuted: boolean;
  isSharing: boolean;
}

interface RoomState {
  roomId: string | null;
  participants: Participant[];
  setRoomId: (id: string) => void;
  addParticipant: (participant: Participant) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  removeParticipant: (id: string) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  participants: [],
  
  setRoomId: (id) => set({ roomId: id }),
  
  addParticipant: (participant) => 
    set((state) => ({
      participants: [...state.participants.filter(p => p.id !== participant.id), participant]
    })),
    
  updateParticipant: (id, updates) => 
    set((state) => ({
      participants: state.participants.map(p => 
        p.id === id ? { ...p, ...updates } : p
      )
    })),
    
  removeParticipant: (id) => 
    set((state) => ({
      participants: state.participants.filter(p => p.id !== id)
    })),
    
  reset: () => set({ roomId: null, participants: [] }),
}));