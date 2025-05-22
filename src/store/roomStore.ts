import { create } from 'zustand';

export interface Participant {
  id: string;
  username: string;
  isMuted: boolean;
  isSharing: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signal: any; // or specific type if known
}

interface RoomState {
  roomId: string | null;
  participants: Participant[];
  setRoomId: (id: string) => void;
  addParticipant: (participant: Participant) => void;
  setParticipants: (participants: Participant[]) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  removeParticipant: (id: string) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  participants: [],
  setParticipants: (participants: Participant[]) => 
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	set((state) => ({
      participants: [...participants]
    })),
  
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