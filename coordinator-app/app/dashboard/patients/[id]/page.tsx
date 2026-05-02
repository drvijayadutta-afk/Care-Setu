'use client';

import { useEffect, useState } from 'react';
import {
  getPatient, getPatientConversations, getPatientCheckins, getPatientAppointments,
  getPatientLabResults, getPatientImaging, getPatientPathology, getPatientVitals,
  getPatientClinicalNotes, getPatientDocuments, getCareTeam,
  Patient, Conversation, Checkin, Appointment, LabResult, ImagingReport,
  PathologyReport, VitalSign, ClinicalNote, PatientDocument, CareTeamMember,
} from '@/lib/api';
import { useWebSocket } from '@/lib/useWebSocket';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiWifi, FiWifiOff } from 'react-icons/fi';
import { TABS, RECORD_REGISTRY, RecordTabId } from '@/lib/recordRegistry';
import {
  OverviewTab, ConversationsTab, CheckinsTab, AppointmentsTab, LabsTab,
  ImagingTab, PathologyTab, VitalsTab, NotesTab, DocumentsTab, CareTeamTab
} from './_tabs';

const TAB_COMPONENTS: Record<RecordTabId, React.ComponentType<any>> = {
  overview: OverviewTab,
  conversations: ConversationsTab,
  checkins: CheckinsTab,
  appointments: AppointmentsTab,
  labs: LabsTab,
  imaging: ImagingTab,
  pathology: PathologyTab,
  vitals: VitalsTab,
  notes: NotesTab,
  documents: DocumentsTab,
  'care-team': CareTeamTab,
};

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [imaging, setImaging] = useState<ImagingReport[]>([]);
  const [pathology, setPathology] = useState<PathologyReport[]>([]);
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [careTeam, setCareTeam] = useState<CareTeamMember[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RecordTabId>('overview');

  useEffect(() => {
    const load = async () => {
      try {
        const [p, conv, chk, apt, labs, img, path, vit, nts, docs, team] = await Promise.all([
          getPatient(patientId),
          getPatientConversations(patientId),
          getPatientCheckins(patientId),
          getPatientAppointments(patientId),
          getPatientLabResults(patientId),
          getPatientImaging(patientId),
          getPatientPathology(patientId),
          getPatientVitals(patientId),
          getPatientClinicalNotes(patientId),
          getPatientDocuments(patientId),
          getCareTeam(patientId),
        ]);
        setPatient(p); setConversations(conv); setCheckins(chk); setAppointments(apt);
        setLabResults(labs); setImaging(img); setPathology(path); setVitals(vit);
        setNotes(nts); setDocuments(docs); setCareTeam(team);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (patientId) load();
  }, [patientId]);

  const { isConnected: wsConnected } = useWebSocket(patientId, async (event: any) => {
    if (event.type === 'message' && event.patientId === patientId)
      setConversations(await getPatientConversations(patientId));
    else if (event.type === 'appointment' && event.patientId === patientId)
      setAppointments(await getPatientAppointments(patientId));
    else if (event.type === 'checkin' && event.patientId === patientId)
      setCheckins(await getPatientCheckins(patientId));
  });

  const TabComponent = TAB_COMPONENTS[activeTab];
  const tabConfig = RECORD_REGISTRY[activeTab];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="rounded-lg p-2 hover:bg-gray-100">
                <FiArrowLeft size={20} className="text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{patient?.name || 'Patient'}</h1>
                <p className="text-sm text-gray-500">{patientId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {wsConnected ? (
                <><FiWifi className="text-green-600" /> Connected</>
              ) : (
                <><FiWifiOff className="text-red-600" /> Offline</>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto pb-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading patient details...</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-white shadow">
            <div className="p-6">
              {activeTab === 'overview' && (
                <OverviewTab patientId={patientId} patient={patient} labResults={labResults} vitals={vitals} careTeam={careTeam} />
              )}
              {activeTab === 'conversations' && (
                <ConversationsTab patientId={patientId} conversations={conversations} onConversationsUpdate={setConversations} />
              )}
              {activeTab === 'checkins' && (
                <CheckinsTab checkins={checkins} />
              )}
              {activeTab === 'appointments' && (
                <AppointmentsTab patientId={patientId} appointments={appointments} onAppointmentsUpdate={setAppointments} />
              )}
              {activeTab === 'labs' && (
                <LabsTab patientId={patientId} labResults={labResults} onLabsUpdate={setLabResults} />
              )}
              {activeTab === 'imaging' && (
                <ImagingTab patientId={patientId} imaging={imaging} onImagingUpdate={setImaging} />
              )}
              {activeTab === 'pathology' && (
                <PathologyTab patientId={patientId} pathology={pathology} onPathologyUpdate={setPathology} />
              )}
              {activeTab === 'vitals' && (
                <VitalsTab patientId={patientId} vitals={vitals} onVitalsUpdate={setVitals} />
              )}
              {activeTab === 'notes' && (
                <NotesTab patientId={patientId} notes={notes} onNotesUpdate={setNotes} />
              )}
              {activeTab === 'documents' && (
                <DocumentsTab patientId={patientId} documents={documents} onDocumentsUpdate={setDocuments} />
              )}
              {activeTab === 'care-team' && (
                <CareTeamTab patientId={patientId} careTeam={careTeam} onCareTeamUpdate={setCareTeam} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
