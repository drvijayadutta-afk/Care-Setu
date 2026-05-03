import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

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
  treatmentProtocol?: string;
  currentCycle?: number;
  hospitalName?: string;
  doctorName?: string;
  // Clinical identity fields
  dateOfBirth?: string;
  gender?: string;
  stage?: string;
  diagnosisDate?: string;
  primarySite?: string;
  histology?: string;
  metastasisSites?: string[];
  ecogScore?: number;
  bloodGroup?: string;
  allergies?: string[];
  comorbidities?: string[];
  createdAt: string;
  lastMessageAt?: string;
}

export interface LabResult {
  id: string;
  patientId: string;
  testDate: string;
  reportedAt?: string;
  category: string;
  testName: string;
  value?: number;
  unit?: string;
  refMin?: number;
  refMax?: number;
  isAbnormal: boolean;
  flag?: string;
  rawText?: string;
  cycleNumber?: number;
  orderedBy?: string;
  source: string;
  documentId?: string;
  notes?: string;
  createdAt: string;
}

export interface ImagingReport {
  id: string;
  patientId: string;
  studyDate: string;
  reportedAt?: string;
  modality: string;
  bodyPart: string;
  indication?: string;
  findings?: string;
  impression?: string;
  response?: string;
  radiologist?: string;
  referenceId?: string;
  documentId?: string;
  source: string;
  notes?: string;
  createdAt: string;
}

export interface PathologyReport {
  id: string;
  patientId: string;
  reportDate: string;
  specimenType: string;
  site: string;
  diagnosis: string;
  grade?: string;
  stage?: string;
  margins?: string;
  ihcFindings?: Record<string, string>;
  molecularTests?: Record<string, string>;
  pathologist?: string;
  labName?: string;
  documentId?: string;
  source: string;
  notes?: string;
  createdAt: string;
}

export interface VitalSign {
  id: string;
  patientId: string;
  recordedAt: string;
  weight?: number;
  height?: number;
  bmi?: number;
  temperature?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  pulseRate?: number;
  oxygenSat?: number;
  ecogScore?: number;
  painScore?: number;
  source: string;
  cycleNumber?: number;
  createdAt: string;
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  noteDate: string;
  noteType: string;
  title: string;
  content: string;
  authorName: string;
  authorRole: string;
  isPrivate: boolean;
  cycleNumber?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PatientDocument {
  id: string;
  patientId: string;
  documentDate?: string;
  category: string;
  title: string;
  description?: string;
  fileType: string;
  fileSizeBytes?: number;
  isVerified: boolean;
  tags: string[];
  uploadedBy?: string;
  createdAt: string;
}

export interface CareTeamMember {
  id: string;
  patientId: string;
  role: string;
  name: string;
  phone?: string;
  email?: string;
  hospitalName?: string;
  department?: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
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
  score: number;
  symptoms: string[];
  emotionalState?: string | null;
  notes?: string | null;
  cycleDay: number;
  ecogScore?: number | null;
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

// Auth
export const login = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data as {
    token: string;
    coordinator: { id: string; email: string; name: string; role: string; hospitalName?: string };
  };
};

// ─── Lab Results ──────────────────────────────────────────────────────────────

export const getPatientLabResults = async (patientId: string, category?: string) => {
  const url = `/patients/${patientId}/lab-results${category ? `?category=${category}` : ''}`;
  const { data } = await api.get(url);
  return data as LabResult[];
};

export const createLabResult = async (patientId: string, result: Partial<LabResult>) => {
  const { data } = await api.post(`/patients/${patientId}/lab-results`, result);
  return data as LabResult;
};

export const bulkCreateLabResults = async (patientId: string, results: Partial<LabResult>[]) => {
  const { data } = await api.post(`/patients/${patientId}/lab-results/bulk`, { results });
  return data as { created: number };
};

// ─── Imaging ──────────────────────────────────────────────────────────────────

export const getPatientImaging = async (patientId: string) => {
  const { data } = await api.get(`/patients/${patientId}/imaging`);
  return data as ImagingReport[];
};

export const createImagingReport = async (patientId: string, report: Partial<ImagingReport>) => {
  const { data } = await api.post(`/patients/${patientId}/imaging`, report);
  return data as ImagingReport;
};

// ─── Pathology ────────────────────────────────────────────────────────────────

export const getPatientPathology = async (patientId: string) => {
  const { data } = await api.get(`/patients/${patientId}/pathology`);
  return data as PathologyReport[];
};

export const createPathologyReport = async (patientId: string, report: Partial<PathologyReport>) => {
  const { data } = await api.post(`/patients/${patientId}/pathology`, report);
  return data as PathologyReport;
};

// ─── Vitals ───────────────────────────────────────────────────────────────────

export const getPatientVitals = async (patientId: string) => {
  const { data } = await api.get(`/patients/${patientId}/vitals`);
  return data as VitalSign[];
};

export const createVitalSign = async (patientId: string, vital: Partial<VitalSign>) => {
  const { data } = await api.post(`/patients/${patientId}/vitals`, vital);
  return data as VitalSign;
};

// ─── Clinical Notes ───────────────────────────────────────────────────────────

export const getPatientClinicalNotes = async (patientId: string, type?: string) => {
  const url = `/patients/${patientId}/clinical-notes${type ? `?type=${type}` : ''}`;
  const { data } = await api.get(url);
  return data as ClinicalNote[];
};

export const createClinicalNote = async (patientId: string, note: Partial<ClinicalNote>) => {
  const { data } = await api.post(`/patients/${patientId}/clinical-notes`, note);
  return data as ClinicalNote;
};

// ─── Documents ────────────────────────────────────────────────────────────────

export const getPatientDocuments = async (patientId: string) => {
  const { data } = await api.get(`/patients/${patientId}/documents`);
  return data as PatientDocument[];
};

export const initiateDocumentUpload = async (
  patientId: string,
  payload: { category: string; fileType: string; title: string; description?: string }
) => {
  const { data } = await api.post(`/patients/${patientId}/documents/upload-url`, payload);
  return data as { uploadUrl: string; documentId: string };
};

export const confirmDocumentUpload = async (
  documentId: string,
  payload: { fileSizeBytes?: number; uploadedBy?: string; documentDate?: string }
) => {
  const { data } = await api.patch(`/documents/${documentId}`, payload);
  return data as PatientDocument;
};

export const getDocumentDownloadUrl = async (documentId: string) => {
  const { data } = await api.get(`/documents/${documentId}/download-url`);
  return data as { downloadUrl: string; title: string; fileType: string };
};

export const extractDocument = async (documentId: string) => {
  const { data } = await api.post(`/documents/${documentId}/extract`);
  return data;
};

export const deleteDocument = async (documentId: string) => {
  const { data } = await api.delete(`/documents/${documentId}`);
  return data;
};

// ─── Care Team ────────────────────────────────────────────────────────────────

export const getCareTeam = async (patientId: string) => {
  const { data } = await api.get(`/patients/${patientId}/care-team`);
  return data as CareTeamMember[];
};

export const addCareTeamMember = async (patientId: string, member: Partial<CareTeamMember>) => {
  const { data } = await api.post(`/patients/${patientId}/care-team`, member);
  return data as CareTeamMember;
};

export const updateCareTeamMember = async (memberId: string, updates: Partial<CareTeamMember>) => {
  const { data } = await api.patch(`/care-team/${memberId}`, updates);
  return data as CareTeamMember;
};

export const removeCareTeamMember = async (memberId: string) => {
  const { data } = await api.delete(`/care-team/${memberId}`);
  return data;
};

// ─── MDT Summary ──────────────────────────────────────────────────────────────

export const getMdtSummary = async (patientId: string) => {
  const { data } = await api.get(`/patients/${patientId}/mdt-summary`);
  return data as { summary: string };
};

// ─── Tumor Board / MDT Meetings ───────────────────────────────────────────────

export interface TumorBoardParticipant {
  id: string;
  meetingId: string;
  name: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  attendanceStatus: 'invited' | 'attended' | 'declined';
  comments?: string | null;
  signedOff: boolean;
  signedOffAt?: string | null;
  createdAt: string;
}

export interface TumorBoardMeeting {
  id: string;
  patientId: string;
  title: string;
  scheduledAt: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  mode: 'sync' | 'async';
  agenda?: string | null;
  briefText?: string | null;
  decision?: { treatment?: string; protocol?: string; nextReview?: string; notes?: string } | null;
  consensusReached: boolean;
  meetingNotes?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  participants: TumorBoardParticipant[];
}

export const getTumorBoardMeetings = async (patientId: string) => {
  const { data } = await api.get(`/patients/${patientId}/tumor-board-meetings`);
  return data as TumorBoardMeeting[];
};

export const createTumorBoardMeeting = async (
  patientId: string,
  body: { title: string; scheduledAt: string; mode?: string; agenda?: string }
) => {
  const { data } = await api.post(`/patients/${patientId}/tumor-board-meetings`, body);
  return data as TumorBoardMeeting;
};

export const updateTumorBoardMeeting = async (
  meetingId: string,
  body: Partial<{
    title: string;
    status: string;
    mode: string;
    agenda: string;
    decision: any;
    consensusReached: boolean;
    meetingNotes: string;
    scheduledAt: string;
  }>
) => {
  const { data } = await api.patch(`/tumor-board-meetings/${meetingId}`, body);
  return data as TumorBoardMeeting;
};

export const cancelTumorBoardMeeting = async (meetingId: string) => {
  await api.delete(`/tumor-board-meetings/${meetingId}`);
};

export const signOffParticipant = async (
  meetingId: string,
  participantId: string,
  signedOff: boolean,
  comments?: string
) => {
  const { data } = await api.patch(
    `/tumor-board-meetings/${meetingId}/participants/${participantId}/sign-off`,
    { signedOff, comments }
  );
  return data as TumorBoardParticipant;
};

export const generateMeetingBrief = async (meetingId: string) => {
  const { data } = await api.post(`/tumor-board-meetings/${meetingId}/brief`, {});
  return data as { briefText: string };
};

// ─── Admin: Manual Patient Creation ───────────────────────────────────────────

export const createPatient = async (body: {
  name: string;
  whatsappNumber?: string;
  cancerType: string;
  treatmentProtocol?: string;
  stage?: string;
  hospitalName: string;
  doctorName?: string;
  gender?: string;
  dateOfBirth?: string;
  assignedCoordinatorId?: string;
}) => {
  const { data } = await api.post('/admin/patients', body);
  return data as Patient;
};

// ─── Outbound Message Log ─────────────────────────────────────────────────────

export interface OutboundMessage {
  id: string;
  patientId: string;
  channel: string;
  recipientRef: string;
  messageType: string;
  content: string;
  externalId: string | null;
  status: string;
  jobId: string | null;
  sentAt: string;
  failureReason: string | null;
}

export const getPatientOutboundMessages = async (
  patientId: string,
  opts?: { limit?: number; cursor?: string; messageType?: string }
) => {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.cursor) params.set('cursor', opts.cursor);
  if (opts?.messageType) params.set('messageType', opts.messageType);
  const { data } = await api.get(`/patients/${patientId}/outbound-messages?${params}`);
  return data as OutboundMessage[];
};

// ─── Doctors ──────────────────────────────────────────────────────────────────

export interface Doctor {
  id: string;
  whatsappNumber: string;
  name: string;
  hospitalName: string;
  specialization: string;
  registrationNumber: string | null;
  qualifications: string[];
  department: string | null;
  experienceYears: number | null;
  secondaryPhone: string | null;
  email: string | null;
  availabilityNotes: string | null;
  photoUrl: string | null;
  bio: string | null;
  isOptedIn: boolean;
  createdAt: string;
}

export const getDoctors = async (hospitalName?: string) => {
  const params = hospitalName ? `?hospitalName=${encodeURIComponent(hospitalName)}` : '';
  const { data } = await api.get(`/doctors${params}`);
  return data as (Doctor & { _count: { patients: number; careTeamMembers: number } })[];
};

export const getDoctor = async (doctorId: string) => {
  const { data } = await api.get(`/doctors/${doctorId}`);
  return data as Doctor;
};

export const createDoctor = async (body: Partial<Doctor>) => {
  const { data } = await api.post('/doctors', body);
  return data as Doctor;
};

export const updateDoctor = async (doctorId: string, body: Partial<Doctor>) => {
  const { data } = await api.patch(`/doctors/${doctorId}`, body);
  return data as Doctor;
};

export const linkCareTeamMemberToDoctor = async (memberId: string, doctorId: string) => {
  const { data } = await api.patch(`/care-team/${memberId}/link-doctor`, { doctorId });
  return data;
};

// ─── Referrals ────────────────────────────────────────────────────────────────

export interface Referral {
  id: string;
  patientId: string;
  fromDoctorId: string | null;
  fromCoordinatorId: string | null;
  toDoctorId: string;
  reason: string;
  urgency: string;
  clinicalContext: string | null;
  status: string;
  acceptedAt: string | null;
  seenAt: string | null;
  completedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  notificationSent: boolean;
  createdAt: string;
  updatedAt: string;
  toDoctor?: Doctor;
  fromCoordinator?: { name: string };
  patient?: { name: string };
}

export const createReferral = async (
  patientId: string,
  body: { toDoctorId: string; reason: string; urgency: string; clinicalContext?: string }
) => {
  const { data } = await api.post(`/patients/${patientId}/referrals`, body);
  return data as Referral;
};

export const getPatientReferrals = async (patientId: string) => {
  const { data } = await api.get(`/patients/${patientId}/referrals`);
  return data as Referral[];
};

export const getAllReferrals = async (filters?: {
  status?: string; urgency?: string; toDoctorId?: string;
}) => {
  const params = new URLSearchParams(filters as any).toString();
  const { data } = await api.get(`/referrals${params ? `?${params}` : ''}`);
  return data as Referral[];
};

export const updateReferralStatus = async (
  referralId: string,
  status: string,
  declineReason?: string
) => {
  const { data } = await api.patch(`/referrals/${referralId}/status`, { status, declineReason });
  return data as Referral;
};

// ─── Audit Log (admin only) ───────────────────────────────────────────────────

export const getAuditLog = async (filters?: {
  coordinatorId?: string; patientId?: string; outOfScopeOnly?: boolean;
  from?: string; to?: string; limit?: number; cursor?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.coordinatorId) params.set('coordinatorId', filters.coordinatorId);
  if (filters?.patientId) params.set('patientId', filters.patientId);
  if (filters?.outOfScopeOnly) params.set('outOfScopeOnly', 'true');
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.cursor) params.set('cursor', filters.cursor);
  const { data } = await api.get(`/admin/audit-log?${params}`);
  return data as any[];
};

export const getAuditSummary = async () => {
  const { data } = await api.get('/admin/audit-log/summary');
  return data as {
    totalAccesses30d: number;
    outOfScopeCount: number;
    crossHospitalCount: number;
    flaggedCoordinators: { coordinatorId: string; name: string; count: number }[];
    topViewedPatients: { patientId: string; name: string; count: number }[];
  };
};

// ─── Activity Feed ────────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  type: string;
  patientId: string;
  patientName: string;
  summary: string;
  severity?: string;
  createdAt: string;
}

export const getActivityFeed = async (limit = 50, cursor?: string) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  const { data } = await api.get(`/activity-feed?${params}`);
  return data as ActivityItem[];
};

export default api;
