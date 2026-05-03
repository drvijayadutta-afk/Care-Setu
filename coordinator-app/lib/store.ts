import { create } from 'zustand';
import { Patient } from './api';

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
    set({
      isAuthenticated: false,
      coordinatorName: '',
      coordinatorRole: 'COORDINATOR',
      selectedPatientId: null,
    });
    localStorage.removeItem('coordinator_token');
    localStorage.removeItem('coordinator_role');
  },
}));
