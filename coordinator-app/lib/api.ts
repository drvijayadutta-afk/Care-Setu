import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('coordinator_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export interface Patient {
  id: string;
  whatsappNumber: string;
  name?: string;
  age?: number;
  cancerType?: string;
  language?: string;
  onboardingStep: number;
  createdAt: string;
  lastMessageAt?: string;
}

export interface Conversation {
  id: string;
  patientId: string;
  role: 'patient' | 'assistant';
  content: string;
  messageType: 'text' | 'voice' | 'interactive';
  createdAt: string;
}

export interface Checkin {
  id: string;
  patientId: string;
  symptomScore: number;
  medications: string;
  notes: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  type: string;
  scheduledAt: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string | null;
  createdAt?: string;
}

// Patient endpoints
export const getPatients = async () => {
  try {
    const { data } = await api.get('/patients');
    return data;
  } catch (error) {
    console.error('Error fetching patients:', error);
    return [];
  }
};

export const getPatient = async (id: string) => {
  const { data } = await api.get(`/patients/${id}`);
  return data as Patient;
};

export const getPatientConversations = async (patientId: string) => {
  const { data } = await api.get(`/patients/${patientId}/conversations`);
  return data as Conversation[];
};

export const getPatientCheckins = async (patientId: string) => {
  const { data } = await api.get(`/patients/${patientId}/checkins`);
  return data as Checkin[];
};

export const getPatientAppointments = async (patientId: string) => {
  const { data } = await api.get(`/patients/${patientId}/appointments`);
  return data as Appointment[];
};

// Coordinator endpoints
export const sendMessage = async (patientId: string, message: string) => {
  const { data } = await api.post(`/patients/${patientId}/send-message`, {
    message,
  });
  return data;
};

export const createAppointment = async (
  patientId: string,
  appointmentData: Partial<Appointment>
) => {
  const { data } = await api.post(`/patients/${patientId}/appointments`, appointmentData);
  return data;
};

// Health check
export const healthCheck = async () => {
  try {
    const { data } = await api.get('/health');
    return data.status === 'ok';
  } catch {
    return false;
  }
};

export default api;
