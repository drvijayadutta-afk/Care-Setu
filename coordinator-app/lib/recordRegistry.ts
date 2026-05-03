import React from 'react';
import {
  FiActivity, FiMessageCircle, FiCheckCircle, FiCalendar, FiBarChart2,
  FiImage, FiFileText, FiUpload, FiUsers, FiClipboard,
} from 'react-icons/fi';

/* Record Type Registry — drives tabs, forms, API integration, and data loading */

export type RecordTabId = 'overview' | 'conversations' | 'checkins' | 'appointments' |
                          'labs' | 'imaging' | 'pathology' | 'vitals' | 'notes' | 'documents' | 'care-team' | 'tumor-board';

export interface TabConfig {
  id: RecordTabId;
  label: string;
  iconType: React.ComponentType<any>;
  section?: 'overview' | 'records' | 'interactions';
}

export const RECORD_REGISTRY: Record<RecordTabId, TabConfig> = {
  overview: {
    id: 'overview',
    label: 'Overview',
    iconType: FiActivity,
    section: 'overview',
  },
  conversations: {
    id: 'conversations',
    label: 'Conversations',
    iconType: FiMessageCircle,
    section: 'interactions',
  },
  checkins: {
    id: 'checkins',
    label: 'Check-ins',
    iconType: FiCheckCircle,
    section: 'interactions',
  },
  appointments: {
    id: 'appointments',
    label: 'Appointments',
    iconType: FiCalendar,
    section: 'interactions',
  },
  labs: {
    id: 'labs',
    label: 'Lab Results',
    iconType: FiBarChart2,
    section: 'records',
  },
  imaging: {
    id: 'imaging',
    label: 'Imaging',
    iconType: FiImage,
    section: 'records',
  },
  pathology: {
    id: 'pathology',
    label: 'Pathology',
    iconType: FiFileText,
    section: 'records',
  },
  vitals: {
    id: 'vitals',
    label: 'Vitals',
    iconType: FiActivity,
    section: 'records',
  },
  notes: {
    id: 'notes',
    label: 'Clinical Notes',
    iconType: FiFileText,
    section: 'records',
  },
  documents: {
    id: 'documents',
    label: 'Documents',
    iconType: FiUpload,
    section: 'records',
  },
  'care-team': {
    id: 'care-team',
    label: 'Care Team',
    iconType: FiUsers,
    section: 'interactions',
  },
  'tumor-board': {
    id: 'tumor-board',
    label: 'Tumor Board',
    iconType: FiClipboard,
    section: 'interactions',
  },
};

export const TABS = Object.values(RECORD_REGISTRY);

/* Utility: Group tabs by section */
export function getTabsBySection(section: 'overview' | 'records' | 'interactions'): TabConfig[] {
  return TABS.filter(tab => tab.section === section);
}

/* Role labels for care team display */
export const ROLE_LABELS: Record<string, string> = {
  MEDICAL_ONCOLOGIST: 'Medical Oncologist',
  RADIATION_ONCOLOGIST: 'Radiation Oncologist',
  SURGICAL_ONCOLOGIST: 'Surgical Oncologist',
  PALLIATIVE: 'Palliative Care',
  NURSE: 'Oncology Nurse',
  DIETITIAN: 'Dietitian',
  PSYCHO_ONCOLOGIST: 'Psycho-oncologist',
  PHARMACIST: 'Pharmacist',
  SOCIAL_WORKER: 'Social Worker',
};

/* Flag/severity colors */
export const FLAG_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 font-bold',
  HIGH:     'bg-orange-100 text-orange-800',
  LOW:      'bg-blue-100 text-blue-800',
  NORMAL:   'bg-green-100 text-green-800',
};
