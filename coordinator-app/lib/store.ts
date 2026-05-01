import { create } from 'zustand';
import { Patient } from './api';

interface CoordinatorStore {
  isAuthenticated: boolean;
  coordinatorName: string;
  selectedPatientId: string | null;
  patients: Patient[];
  setAuthenticated: (value: boolean) => void;
  setCoordinatorName: (name: string) => void;
  setSelectedPatient: (id: string | null) => void;
  setPatients: (patients: Patient[]) => void;
  logout: () => void;
}

export const useCoordinatorStore = create<CoordinatorStore>((set) => ({
  isAuthenticated: false,
  coordinatorName: '',
  selectedPatientId: null,
  patients: [],
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setCoordinatorName: (name) => set({ coordinatorName: name }),
  setSelectedPatient: (id) => set({ selectedPatientId: id }),
  setPatients: (patients) => set({ patients }),
  logout: () => {
    set({
      isAuthenticated: false,
      coordinatorName: '',
      selectedPatientId: null,
    });
    localStorage.removeItem('coordinator_token');
  },
}));
