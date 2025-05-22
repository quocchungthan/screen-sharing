import { create } from 'zustand';

interface UserState {
  username: string;
  isMuted: boolean;
  isSharing: boolean;
  setUsername: (name: string) => void;
  toggleMute: () => void;
  setSharing: (isSharing: boolean) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  username: '',
  isMuted: true,
  isSharing: false,
  setUsername: (name) => set({ username: name }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setSharing: (isSharing) => set({ isSharing }),
  reset: () => set({ username: '', isMuted: true, isSharing: false }),
}));