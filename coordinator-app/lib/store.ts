import { create } from 'zustand';
import axios from 'axios';
import { Patient } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

interface CoordinatorStore {
  isAuthenticated: boolean;
  coordinatorName: string;
  coordinatorRole: string; // 'COORDINATOR' | 'ADMIN'
  selectedPatientId: string | null;
  patients: Patient[];
  setAuthenticated: (value: boolean) => void;
  setCoordinatorName: (name: string) => void;
  setCoordinatorRole: (role: string) => void;
  setSelectedPatient: (id: string | null) => void;
  setPatients: (patients: Patient[]) => void;
  logout: () => void;
}

export const useCoordinatorStore = create<CoordinatorStore>((set) => ({
  isAuthenticated: false,
  coordinatorName: '',
  coordinatorRole: 'COORDINATOR',
  selectedPatientId: null,
  patients: [],
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setCoordinatorName: (name) => set({ coordinatorName: name }),
  setCoordinatorRole: (role) => set({ coordinatorRole: role }),
  setSelectedPatient: (id) => set({ selectedPatientId: id }),
  setPatients: (patients) => set({ patients }),
  logout: () => {
    // Clear local state + tell server to clear the HttpOnly cookie.
    set({
      isAuthenticated: false,
      coordinatorName: '',
      coordinatorRole: 'COORDINATOR',
      selectedPatientId: null,
    });
    // Fire-and-forget — even if it fails, local state is already cleared.
    axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
  },
}));
