import type {
  Patient,
  Coordinator,
  Conversation,
  Checkin,
  Appointment,
  LabResult,
  ImagingReport,
  PathologyReport,
  VitalSign,
  ClinicalNote,
  PatientDocument,
  CareTeamMember,
} from "@prisma/client";

// Patient repository
export interface IPatientRepository {
  findUnique(id: string): Promise<Patient | null>;
  findMany(opts?: { take?: number; orderBy?: { [key: string]: "asc" | "desc" } }): Promise<Patient[]>;
  findByWhatsApp(phoneNumber: string): Promise<Patient | null>;
  findByTelegram(chatId: string): Promise<Patient | null>;
  create(data: any): Promise<Patient>;
  update(id: string, data: any): Promise<Patient>;
  count(): Promise<number>;
}

// Coordinator repository
export interface ICoordinatorRepository {
  findUnique(id: string): Promise<Coordinator | null>;
  findByEmail(email: string): Promise<Coordinator | null>;
  create(data: any): Promise<Coordinator>;
  update(id: string, data: any): Promise<Coordinator>;
}

// Conversation repository
export interface IConversationRepository {
  findMany(
    patientId: string,
    opts?: { take?: number; orderBy?: { [key: string]: "asc" | "desc" } }
  ): Promise<Conversation[]>;
  create(data: any): Promise<Conversation>;
}

// Clinical records — unified interface
export interface IRecordRepository {
  // Lab Results
  labResults: {
    findMany(patientId: string): Promise<LabResult[]>;
    create(data: any): Promise<LabResult>;
    update(id: string, data: any): Promise<LabResult>;
    delete(id: string): Promise<void>;
  };

  // Imaging
  imaging: {
    findMany(patientId: string): Promise<ImagingReport[]>;
    create(data: any): Promise<ImagingReport>;
    update(id: string, data: any): Promise<ImagingReport>;
    delete(id: string): Promise<void>;
  };

  // Pathology
  pathology: {
    findMany(patientId: string): Promise<PathologyReport[]>;
    create(data: any): Promise<PathologyReport>;
    update(id: string, data: any): Promise<PathologyReport>;
    delete(id: string): Promise<void>;
  };

  // Vitals
  vitals: {
    findMany(patientId: string): Promise<VitalSign[]>;
    findLatest(patientId: string): Promise<VitalSign | null>;
    create(data: any): Promise<VitalSign>;
    update(id: string, data: any): Promise<VitalSign>;
    delete(id: string): Promise<void>;
  };

  // Clinical Notes
  notes: {
    findMany(patientId: string): Promise<ClinicalNote[]>;
    create(data: any): Promise<ClinicalNote>;
    update(id: string, data: any): Promise<ClinicalNote>;
    delete(id: string): Promise<void>;
  };

  // Documents
  documents: {
    findMany(patientId: string): Promise<PatientDocument[]>;
    create(data: any): Promise<PatientDocument>;
    update(id: string, data: any): Promise<PatientDocument>;
    delete(id: string): Promise<void>;
  };

  // Care Team
  careTeam: {
    findMany(patientId: string): Promise<CareTeamMember[]>;
    create(data: any): Promise<CareTeamMember>;
    update(id: string, data: any): Promise<CareTeamMember>;
    delete(id: string): Promise<void>;
  };

  // Checkins
  checkins: {
    findMany(patientId: string): Promise<Checkin[]>;
    create(data: any): Promise<Checkin>;
    update(id: string, data: any): Promise<Checkin>;
    delete(id: string): Promise<void>;
  };

  // Appointments
  appointments: {
    findMany(patientId: string): Promise<Appointment[]>;
    findUnique(id: string): Promise<Appointment | null>;
    create(data: any): Promise<Appointment>;
    update(id: string, data: any): Promise<Appointment>;
    delete(id: string): Promise<void>;
  };
}

// Request decorator to inject repos
declare global {
  namespace Express {
    interface Request {
      patientRepo?: IPatientRepository;
      coordinatorRepo?: ICoordinatorRepository;
      conversationRepo?: IConversationRepository;
      recordRepo?: IRecordRepository;
    }
  }
}
