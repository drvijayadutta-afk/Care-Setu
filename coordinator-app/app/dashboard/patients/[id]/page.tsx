'use client';

import { useEffect, useState, createElement, useCallback } from 'react';
import {
  getPatient, getPatientConversations, getPatientCheckins, getPatientAppointments,
  getPatientLabResults, getPatientImaging, getPatientPathology, getPatientVitals,
  getPatientClinicalNotes, getPatientDocuments, getCareTeam, getTumorBoardMeetings,
  getPatientOutboundMessages, getPatientReferrals,
  Patient, Conversation, Checkin, Appointment, LabResult, ImagingReport,
  PathologyReport, VitalSign, ClinicalNote, PatientDocument, CareTeamMember, TumorBoardMeeting,
  OutboundMessage, Referral,
} from '@/lib/api';
import { useWebSocket } from '@/lib/useWebSocket';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiWifi, FiWifiOff } from 'react-icons/fi';
import { pushNotification } from '@/components/NotificationsBell';
import { TABS, RECORD_REGISTRY, RecordTabId } from '@/lib/recordRegistry';
import {
  OverviewTab, ConversationsTab, CheckinsTab, AppointmentsTab, LabsTab,
  ImagingTab, PathologyTab, VitalsTab, NotesTab, DocumentsTab, CareTeamTab, TumorBoardTab,
  OutboundMessagesTab, ReferralsTab,
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
  'tumor-board': TumorBoardTab,
  'outbound-messages': OutboundMessagesTab,
  referrals: ReferralsTab,
};

// Which tabs are critical (loaded immediately) vs deferred (loaded on first click)
const CRITICAL_TABS = new Set<RecordTabId>(['overview', 'conversations', 'checkins', 'appointments']);

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
  const [tumorBoardMeetings, setTumorBoardMeetings] = useState<TumorBoardMeeting[]>([]);
  const [outboundMessages, setOutboundMessages] = useState<OutboundMessage[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);

  // Two-phase loading: critical = patient header + overview data; secondary = rest
  const [loadingCritical, setLoadingCritical] = useState(true);
  const [loadedTabs, setLoadedTabs] = useState<Set<RecordTabId>>(new Set());
  const [activeTab, setActiveTab] = useState<RecordTabId>('overview');

  // Load critical data on mount
  useEffect(() => {
    if (!patientId) return;
    const load = async () => {
      try {
        const [p, conv, chk, apt, labs, vit, team] = await Promise.all([
          getPatient(patientId),
          getPatientConversations(patientId),
          getPatientCheckins(patientId),
          getPatientAppointments(patientId),
          getPatientLabResults(patientId),
          getPatientVitals(patientId),
          getCareTeam(patientId),
        ]);
        setPatient(p);
        setConversations(conv);
        setCheckins(chk);
        setAppointments(apt);
        setLabResults(labs);
        setVitals(vit);
        setCareTeam(team);
        setLoadedTabs(new Set(['overview', 'conversations', 'checkins', 'appointments', 'labs', 'vitals', 'care-team'] as RecordTabId[]));
      } catch (e) { console.error(e); }
      finally { setLoadingCritical(false); }
    };
    load();
  }, [patientId]);

  // Load deferred tab data on first click
  const loadTabData = useCallback(async (tab: RecordTabId) => {
    if (loadedTabs.has(tab)) return;
    setLoadedTabs(prev => new Set([...prev, tab]));
    try {
      if (tab === 'imaging') { const d = await getPatientImaging(patientId); setImaging(d); }
      else if (tab === 'pathology') { const d = await getPatientPathology(patientId); setPathology(d); }
      else if (tab === 'notes') { const d = await getPatientClinicalNotes(patientId); setNotes(d); }
      else if (tab === 'documents') { const d = await getPatientDocuments(patientId); setDocuments(d); }
      else if (tab === 'tumor-board') {
        // Load meetings + ensure imaging/pathology are loaded for the context panel
        const [tb, img, path] = await Promise.all([
          getTumorBoardMeetings(patientId),
          loadedTabs.has('imaging') ? Promise.resolve(imaging) : getPatientImaging(patientId),
          loadedTabs.has('pathology') ? Promise.resolve(pathology) : getPatientPathology(patientId),
        ]);
        setTumorBoardMeetings(tb);
        if (!loadedTabs.has('imaging')) setImaging(img);
        if (!loadedTabs.has('pathology')) setPathology(path);
      }
      else if (tab === 'outbound-messages') {
        const msgs = await getPatientOutboundMessages(patientId);
        setOutboundMessages(msgs);
      }
      else if (tab === 'referrals') {
        const refs = await getPatientReferrals(patientId);
        setReferrals(refs);
      }
    } catch (e) { console.error(e); }
  }, [patientId, loadedTabs, imaging, pathology]);

  const handleTabChange = (tab: RecordTabId) => {
    setActiveTab(tab);
    loadTabData(tab);
  };

  const { isConnected: wsConnected } = useWebSocket(patientId, async (event: any) => {
    if (event.type === 'message' && event.patientId === patientId)
      setConversations(await getPatientConversations(patientId));
    else if (event.type === 'appointment' && event.patientId === patientId)
      setAppointments(await getPatientAppointments(patientId));
    else if (event.type === 'checkin' && event.patientId === patientId)
      setCheckins(await getPatientCheckins(patientId));
    else if (event.type === 'alert' && event.patientId === patientId) {
      pushNotification({
        type: 'alert',
        patientId,
        message: `${event.severity?.toUpperCase() || 'ALERT'}: ${event.message}`,
        severity: event.severity,
      });
    }
    else if (event.type === 'document_uploaded' && event.patientId === patientId) {
      pushNotification({
        type: 'document_uploaded',
        patientId,
        message: `New ${event.category?.toLowerCase().replace(/_/g, ' ')} uploaded: ${event.title}`,
      });
    }
    else if (event.type === 'tumor-board' && event.patientId === patientId) {
      pushNotification({
        type: 'tumor-board',
        patientId,
        message: `Tumor board ${event.action}: ${event.title}`,
      });
      // Refresh tumor board meetings if currently loaded
      if (loadedTabs.has('tumor-board')) {
        const meetings = await getTumorBoardMeetings(patientId);
        setTumorBoardMeetings(meetings);
      }
    }
  });

  const TabComponent = TAB_COMPONENTS[activeTab];

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
                <h1 className="text-2xl font-bold text-gray-900">
                  {loadingCritical ? <span className="inline-block h-7 w-40 animate-pulse rounded bg-gray-200" /> : (patient?.name || 'Patient')}
                </h1>
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
          {/* Fade edge on right to signal scrollability */}
          <div className="relative">
            <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {createElement(tab.iconType)} {tab.label}
                </button>
              ))}
            </div>
            {/* Scroll-right affordance */}
            <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-white to-transparent" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {loadingCritical ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
              <p className="text-gray-500">Loading patient…</p>
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
                !loadedTabs.has('imaging')
                  ? <div className="text-center text-gray-500 py-12">Loading…</div>
                  : <ImagingTab patientId={patientId} imaging={imaging} onImagingUpdate={setImaging} />
              )}
              {activeTab === 'pathology' && (
                !loadedTabs.has('pathology')
                  ? <div className="text-center text-gray-500 py-12">Loading…</div>
                  : <PathologyTab patientId={patientId} pathology={pathology} onPathologyUpdate={setPathology} />
              )}
              {activeTab === 'vitals' && (
                <VitalsTab patientId={patientId} vitals={vitals} onVitalsUpdate={setVitals} />
              )}
              {activeTab === 'notes' && (
                !loadedTabs.has('notes')
                  ? <div className="text-center text-gray-500 py-12">Loading…</div>
                  : <NotesTab patientId={patientId} notes={notes} onNotesUpdate={setNotes} />
              )}
              {activeTab === 'documents' && (
                !loadedTabs.has('documents')
                  ? <div className="text-center text-gray-500 py-12">Loading…</div>
                  : <DocumentsTab patientId={patientId} documents={documents} onDocumentsUpdate={setDocuments} />
              )}
              {activeTab === 'care-team' && (
                <CareTeamTab patientId={patientId} careTeam={careTeam} onCareTeamUpdate={setCareTeam} />
              )}
              {activeTab === 'tumor-board' && (
                !loadedTabs.has('tumor-board')
                  ? <div className="text-center text-gray-500 py-12">Loading…</div>
                  : <TumorBoardTab
                      patientId={patientId}
                      meetings={tumorBoardMeetings}
                      checkins={checkins}
                      conversations={conversations}
                      labResults={labResults}
                      imaging={imaging}
                      pathology={pathology}
                      onMeetingsUpdate={setTumorBoardMeetings}
                    />
              )}
              {activeTab === 'outbound-messages' && (
                !loadedTabs.has('outbound-messages')
                  ? <div className="text-center text-gray-500 py-12">Loading…</div>
                  : <OutboundMessagesTab patientId={patientId} messages={outboundMessages} />
              )}
              {activeTab === 'referrals' && (
                !loadedTabs.has('referrals')
                  ? <div className="text-center text-gray-500 py-12">Loading…</div>
                  : <ReferralsTab patientId={patientId} referrals={referrals} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
