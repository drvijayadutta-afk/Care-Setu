'use client';

import { useEffect, useState, useRef } from 'react';
import {
  getPatient, getPatientConversations, getPatientCheckins, getPatientAppointments,
  sendMessage, createAppointment,
  getPatientLabResults, createLabResult,
  getPatientImaging, createImagingReport,
  getPatientPathology, createPathologyReport,
  getPatientVitals, createVitalSign,
  getPatientClinicalNotes, createClinicalNote,
  getPatientDocuments, initiateDocumentUpload, confirmDocumentUpload,
  getDocumentDownloadUrl, extractDocument, deleteDocument,
  getCareTeam, addCareTeamMember, removeCareTeamMember,
  getMdtSummary,
  Patient, Conversation, Checkin, Appointment,
  LabResult, ImagingReport, PathologyReport, VitalSign, ClinicalNote,
  PatientDocument, CareTeamMember,
} from '@/lib/api';
import { useWebSocket } from '@/lib/useWebSocket';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  FiArrowLeft, FiMessageCircle, FiCheckCircle, FiCalendar, FiSend, FiPlus,
  FiWifi, FiWifiOff, FiActivity, FiFileText, FiImage, FiUser, FiUsers,
  FiUpload, FiDownload, FiTrash2, FiRefreshCw, FiAlertCircle, FiBarChart2,
} from 'react-icons/fi';

type Tab = 'overview' | 'conversations' | 'checkins' | 'appointments' | 'labs' |
           'imaging' | 'pathology' | 'vitals' | 'notes' | 'documents' | 'care-team';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',       label: 'Overview',       icon: <FiActivity /> },
  { id: 'conversations',  label: 'Conversations',  icon: <FiMessageCircle /> },
  { id: 'checkins',       label: 'Check-ins',      icon: <FiCheckCircle /> },
  { id: 'appointments',   label: 'Appointments',   icon: <FiCalendar /> },
  { id: 'labs',           label: 'Lab Results',    icon: <FiBarChart2 /> },
  { id: 'imaging',        label: 'Imaging',        icon: <FiImage /> },
  { id: 'pathology',      label: 'Pathology',      icon: <FiFileText /> },
  { id: 'vitals',         label: 'Vitals',         icon: <FiActivity /> },
  { id: 'notes',          label: 'Clinical Notes', icon: <FiFileText /> },
  { id: 'documents',      label: 'Documents',      icon: <FiUpload /> },
  { id: 'care-team',      label: 'Care Team',      icon: <FiUsers /> },
];

const ROLE_LABELS: Record<string, string> = {
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

const FLAG_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 font-bold',
  HIGH:     'bg-orange-100 text-orange-800',
  LOW:      'bg-blue-100 text-blue-800',
  NORMAL:   'bg-green-100 text-green-800',
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
  const [mdtSummary, setMdtSummary] = useState<string>('');
  const [mdtLoading, setMdtLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Message
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Appointment form
  const [showApptForm, setShowApptForm] = useState(false);
  const [apptForm, setApptForm] = useState({ type: '', scheduledAt: '', notes: '', status: 'pending' as const });

  // Lab form
  const [showLabForm, setShowLabForm] = useState(false);
  const [labForm, setLabForm] = useState({ testDate: '', category: 'CBC', testName: '', value: '', unit: '', refMin: '', refMax: '', flag: '', notes: '' });

  // Imaging form
  const [showImagingForm, setShowImagingForm] = useState(false);
  const [imagingForm, setImagingForm] = useState({ studyDate: '', modality: 'CT', bodyPart: '', indication: '', findings: '', impression: '', response: '', radiologist: '' });

  // Pathology form
  const [showPathForm, setShowPathForm] = useState(false);
  const [pathForm, setPathForm] = useState({ reportDate: '', specimenType: 'BIOPSY', site: '', diagnosis: '', grade: '', stage: '', margins: '', pathologist: '', labName: '' });

  // Vitals form
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({ weight: '', height: '', bpSystolic: '', bpDiastolic: '', pulseRate: '', oxygenSat: '', temperature: '', ecogScore: '', painScore: '' });

  // Clinical note form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState({ noteType: 'CONSULTATION', title: '', content: '', authorName: '', authorRole: 'COORDINATOR' });

  // Care team form
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamForm, setTeamForm] = useState({ role: 'MEDICAL_ONCOLOGIST', name: '', phone: '', email: '', hospitalName: '', department: '', isPrimary: false });

  // Document upload
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docCategory, setDocCategory] = useState('LAB_REPORT');
  const [docTitle, setDocTitle] = useState('');

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

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    setSendingMessage(true);
    try {
      await sendMessage(patientId, messageInput);
      setMessageInput('');
      setConversations(await getPatientConversations(patientId));
    } catch { alert('Failed to send message'); }
    finally { setSendingMessage(false); }
  };

  const handleCreateAppt = async () => {
    if (!apptForm.type || !apptForm.scheduledAt) return alert('Fill required fields');
    try {
      await createAppointment(patientId, apptForm);
      setApptForm({ type: '', scheduledAt: '', notes: '', status: 'pending' });
      setShowApptForm(false);
      setAppointments(await getPatientAppointments(patientId));
    } catch { alert('Failed to create appointment'); }
  };

  const handleAddLab = async () => {
    if (!labForm.testDate || !labForm.testName) return alert('Fill required fields');
    const isAbnormal = !!(labForm.flag && labForm.flag !== 'NORMAL');
    await createLabResult(patientId, { ...labForm, isAbnormal, value: labForm.value ? parseFloat(labForm.value) : undefined, refMin: labForm.refMin ? parseFloat(labForm.refMin) : undefined, refMax: labForm.refMax ? parseFloat(labForm.refMax) : undefined });
    setLabForm({ testDate: '', category: 'CBC', testName: '', value: '', unit: '', refMin: '', refMax: '', flag: '', notes: '' });
    setShowLabForm(false);
    setLabResults(await getPatientLabResults(patientId));
  };

  const handleAddImaging = async () => {
    if (!imagingForm.studyDate || !imagingForm.modality || !imagingForm.bodyPart) return alert('Fill required fields');
    await createImagingReport(patientId, imagingForm);
    setImagingForm({ studyDate: '', modality: 'CT', bodyPart: '', indication: '', findings: '', impression: '', response: '', radiologist: '' });
    setShowImagingForm(false);
    setImaging(await getPatientImaging(patientId));
  };

  const handleAddPath = async () => {
    if (!pathForm.reportDate || !pathForm.site || !pathForm.diagnosis) return alert('Fill required fields');
    await createPathologyReport(patientId, pathForm);
    setPathForm({ reportDate: '', specimenType: 'BIOPSY', site: '', diagnosis: '', grade: '', stage: '', margins: '', pathologist: '', labName: '' });
    setShowPathForm(false);
    setPathology(await getPatientPathology(patientId));
  };

  const handleAddVitals = async () => {
    await createVitalSign(patientId, {
      weight: vitalsForm.weight ? parseFloat(vitalsForm.weight) : undefined,
      height: vitalsForm.height ? parseFloat(vitalsForm.height) : undefined,
      bpSystolic: vitalsForm.bpSystolic ? parseInt(vitalsForm.bpSystolic) : undefined,
      bpDiastolic: vitalsForm.bpDiastolic ? parseInt(vitalsForm.bpDiastolic) : undefined,
      pulseRate: vitalsForm.pulseRate ? parseInt(vitalsForm.pulseRate) : undefined,
      oxygenSat: vitalsForm.oxygenSat ? parseFloat(vitalsForm.oxygenSat) : undefined,
      temperature: vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : undefined,
      ecogScore: vitalsForm.ecogScore ? parseInt(vitalsForm.ecogScore) : undefined,
      painScore: vitalsForm.painScore ? parseInt(vitalsForm.painScore) : undefined,
    });
    setVitalsForm({ weight: '', height: '', bpSystolic: '', bpDiastolic: '', pulseRate: '', oxygenSat: '', temperature: '', ecogScore: '', painScore: '' });
    setShowVitalsForm(false);
    setVitals(await getPatientVitals(patientId));
  };

  const handleAddNote = async () => {
    if (!noteForm.title || !noteForm.content || !noteForm.authorName) return alert('Fill required fields');
    await createClinicalNote(patientId, noteForm);
    setNoteForm({ noteType: 'CONSULTATION', title: '', content: '', authorName: '', authorRole: 'COORDINATOR' });
    setShowNoteForm(false);
    setNotes(await getPatientClinicalNotes(patientId));
  };

  const handleAddTeamMember = async () => {
    if (!teamForm.name || !teamForm.role) return alert('Fill required fields');
    await addCareTeamMember(patientId, teamForm);
    setTeamForm({ role: 'MEDICAL_ONCOLOGIST', name: '', phone: '', email: '', hospitalName: '', department: '', isPrimary: false });
    setShowTeamForm(false);
    setCareTeam(await getCareTeam(patientId));
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    await removeCareTeamMember(memberId);
    setCareTeam(await getCareTeam(patientId));
  };

  const handleUploadDocument = async (file: File) => {
    if (!docTitle) return alert('Enter a document title first');
    setUploadingDoc(true);
    try {
      const ext = file.name.split('.').pop() ?? 'pdf';
      const { uploadUrl, documentId } = await initiateDocumentUpload(patientId, {
        category: docCategory, fileType: ext, title: docTitle,
      });
      // Upload directly to Supabase from browser
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      await confirmDocumentUpload(documentId, { fileSizeBytes: file.size, uploadedBy: 'coordinator' });
      setDocTitle(''); setDocCategory('LAB_REPORT');
      setDocuments(await getPatientDocuments(patientId));
    } catch (e) { alert('Upload failed'); console.error(e); }
    finally { setUploadingDoc(false); }
  };

  const handleDownloadDocument = async (docId: string) => {
    try {
      const { downloadUrl, title } = await getDocumentDownloadUrl(docId);
      const a = document.createElement('a');
      a.href = downloadUrl; a.download = title; a.target = '_blank';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { alert('Download failed'); }
  };

  const handleExtractDocument = async (docId: string) => {
    try {
      await extractDocument(docId);
      alert('Extraction complete — structured records auto-created');
      setLabResults(await getPatientLabResults(patientId));
      setImaging(await getPatientImaging(patientId));
      setPathology(await getPatientPathology(patientId));
    } catch { alert('Extraction failed'); }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Delete this document permanently?')) return;
    await deleteDocument(docId);
    setDocuments(await getPatientDocuments(patientId));
  };

  const handleLoadMdtSummary = async () => {
    setMdtLoading(true);
    try {
      const { summary } = await getMdtSummary(patientId);
      setMdtSummary(summary);
    } catch { alert('Failed to generate MDT summary'); }
    finally { setMdtLoading(false); }
  };

  if (loading) return <div className="text-center text-gray-500 py-16">Loading patient record...</div>;
  if (!patient) return <div className="text-center text-gray-500 py-16">Patient not found</div>;

  const latestVitals = vitals[0];
  const primaryDoc = careTeam.find(m => m.isPrimary) ?? careTeam.find(m => m.role === 'MEDICAL_ONCOLOGIST');
  const abnormalLabs = labResults.filter(l => l.isAbnormal);

  return (
    <div className="pb-16">
      <Link href="/dashboard/patients" className="mb-6 flex items-center gap-2 text-indigo-600 hover:text-indigo-900">
        <FiArrowLeft /> Back to Patients
      </Link>

      {/* Patient Header */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow border-l-4 border-indigo-500">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{patient.name ?? 'Unnamed Patient'}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              {patient.gender && <span className="text-gray-500">{patient.gender}</span>}
              {patient.dateOfBirth && <span className="text-gray-500">· DOB {new Date(patient.dateOfBirth).toLocaleDateString()}</span>}
              {patient.bloodGroup && <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{patient.bloodGroup}</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {patient.stage && <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800">{patient.stage}</span>}
              {patient.ecogScore != null && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">ECOG {patient.ecogScore}</span>}
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">{patient.cancerType}</span>
              {patient.histology && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{patient.histology}</span>}
              {patient.diagnosisDate && <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs text-yellow-800">Dx {new Date(patient.diagnosisDate).toLocaleDateString()}</span>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600">
              <span><b>Protocol:</b> {patient.treatmentProtocol} · Cycle {patient.currentCycle}</span>
              <span><b>Hospital:</b> {patient.hospitalName}</span>
              {primaryDoc && <span><b>Primary Oncologist:</b> {primaryDoc.name}</span>}
              {patient.primarySite && <span><b>Primary Site:</b> {patient.primarySite}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`rounded-full px-4 py-1.5 text-sm font-semibold text-white ${patient.onboardingStep >= 9 ? 'bg-green-600' : 'bg-yellow-500'}`}>
              {patient.onboardingStep >= 9 ? 'Active' : 'Onboarding'}
            </span>
            {abnormalLabs.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                <FiAlertCircle className="text-red-500" /> {abnormalLabs.length} abnormal lab{abnormalLabs.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* WS Status */}
      <div className={`mb-4 rounded-lg p-2 flex items-center gap-2 text-sm ${wsConnected ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
        {wsConnected ? <><FiWifi /> Real-time updates connected</> : <><FiWifiOff /> Connecting...</>}
      </div>

      {/* Tabs */}
      <div className="mb-4 overflow-x-auto">
        <div className="flex gap-1 border-b border-gray-200 min-w-max">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 pb-3 pt-1 text-sm font-medium whitespace-nowrap ${activeTab === tab.id ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message Bar (always visible for conversations tab) */}
      {activeTab === 'conversations' && (
        <div className="mb-4 rounded-lg bg-white p-3 shadow flex gap-2">
          <input type="text" value={messageInput} onChange={e => setMessageInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            placeholder="Send a message to patient via WhatsApp..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" disabled={sendingMessage} />
          <button onClick={handleSendMessage} disabled={sendingMessage || !messageInput.trim()}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-400">
            <FiSend /> {sendingMessage ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div className="rounded-xl bg-white p-6 shadow">

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Check-ins', value: checkins.length, color: 'indigo' },
                { label: 'Appointments', value: appointments.length, color: 'green' },
                { label: 'Lab Results', value: labResults.length, color: 'blue' },
                { label: 'Documents', value: documents.length, color: 'purple' },
              ].map(s => (
                <div key={s.label} className={`rounded-lg bg-${s.color}-50 p-4 text-center`}>
                  <div className={`text-3xl font-bold text-${s.color}-700`}>{s.value}</div>
                  <div className="text-sm text-gray-600 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {latestVitals && (
              <div>
                <h3 className="mb-2 font-semibold text-gray-800">Latest Vitals</h3>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 text-sm">
                  {latestVitals.weight && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.weight} kg</div><div className="text-gray-500 text-xs">Weight</div></div>}
                  {latestVitals.bpSystolic && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.bpSystolic}/{latestVitals.bpDiastolic}</div><div className="text-gray-500 text-xs">BP mmHg</div></div>}
                  {latestVitals.pulseRate && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.pulseRate}</div><div className="text-gray-500 text-xs">Pulse/min</div></div>}
                  {latestVitals.oxygenSat && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.oxygenSat}%</div><div className="text-gray-500 text-xs">SpO₂</div></div>}
                  {latestVitals.temperature && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.temperature}°C</div><div className="text-gray-500 text-xs">Temp</div></div>}
                  {latestVitals.ecogScore != null && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.ecogScore}</div><div className="text-gray-500 text-xs">ECOG</div></div>}
                </div>
              </div>
            )}

            {abnormalLabs.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold text-red-700">Abnormal Lab Values</h3>
                <div className="space-y-1">
                  {abnormalLabs.slice(0, 8).map(l => (
                    <div key={l.id} className="flex items-center justify-between rounded bg-red-50 px-3 py-2 text-sm">
                      <span className="font-medium">{l.testName}</span>
                      <span>{l.value} {l.unit}</span>
                      {l.flag && <span className={`rounded px-2 py-0.5 text-xs ${FLAG_COLORS[l.flag] ?? 'bg-gray-100'}`}>{l.flag}</span>}
                      <span className="text-gray-400 text-xs">{new Date(l.testDate).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {careTeam.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold text-gray-800">Care Team</h3>
                <div className="flex flex-wrap gap-2">
                  {careTeam.map(m => (
                    <div key={m.id} className="rounded-lg bg-indigo-50 px-3 py-2 text-sm">
                      <div className="font-semibold text-indigo-800">{m.name}</div>
                      <div className="text-xs text-indigo-600">{ROLE_LABELS[m.role] ?? m.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MDT Summary */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800">AI MDT Brief</h3>
                <button onClick={handleLoadMdtSummary} disabled={mdtLoading}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:bg-gray-400">
                  <FiRefreshCw className={mdtLoading ? 'animate-spin' : ''} />
                  {mdtLoading ? 'Generating...' : 'Generate MDT Brief'}
                </button>
              </div>
              {mdtSummary && (
                <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-700 border border-gray-200 font-sans leading-relaxed">
                  {mdtSummary}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* CONVERSATIONS */}
        {activeTab === 'conversations' && (
          <div className="space-y-3">
            {conversations.length === 0 ? <p className="text-gray-400">No conversations yet.</p> : conversations.map(c => (
              <div key={c.id} className={`rounded-lg p-3 ${c.role === 'patient' ? 'bg-green-50 border-l-4 border-green-500' : 'bg-indigo-50 border-l-4 border-indigo-400'}`}>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span className="font-semibold">{c.role === 'patient' ? '🧑 Patient' : '🤖 Assistant'}</span>
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-700">{c.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* CHECK-INS */}
        {activeTab === 'checkins' && (
          <div className="space-y-3">
            {checkins.length === 0 ? <p className="text-gray-400">No check-ins yet.</p> : checkins.map(c => (
              <div key={c.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${(c as any).score >= 4 ? 'bg-green-100 text-green-800' : (c as any).score >= 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      Score {(c as any).score}/5
                    </span>
                    {(c as any).symptoms?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(c as any).symptoms.map((s: string) => (
                          <span key={s} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{s}</span>
                        ))}
                      </div>
                    )}
                    {(c as any).notes && <p className="mt-1 text-sm text-gray-600">{(c as any).notes}</p>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div>
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Appointments</h3>
              <button onClick={() => setShowApptForm(!showApptForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">
                <FiPlus /> New
              </button>
            </div>
            {showApptForm && (
              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Type (e.g. Chemotherapy)" value={apptForm.type} onChange={e => setApptForm({ ...apptForm, type: e.target.value })} className="rounded border px-3 py-2 text-sm col-span-2" />
                  <input type="datetime-local" value={apptForm.scheduledAt} onChange={e => setApptForm({ ...apptForm, scheduledAt: e.target.value })} className="rounded border px-3 py-2 text-sm col-span-2" />
                  <textarea placeholder="Notes" value={apptForm.notes} onChange={e => setApptForm({ ...apptForm, notes: e.target.value })} className="rounded border px-3 py-2 text-sm col-span-2" rows={2} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateAppt} className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white">Create</button>
                  <button onClick={() => setShowApptForm(false)} className="flex-1 rounded bg-gray-300 py-2 text-sm">Cancel</button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {appointments.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                  <div>
                    <div className="font-semibold text-gray-800">{a.type}</div>
                    <div className="text-sm text-gray-500">{new Date(a.scheduledAt).toLocaleString()}</div>
                    {a.notes && <div className="text-sm text-gray-500 mt-1">{a.notes}</div>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${a.status === 'confirmed' ? 'bg-green-100 text-green-800' : a.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>{a.status}</span>
                </div>
              ))}
              {appointments.length === 0 && <p className="text-gray-400">No appointments yet.</p>}
            </div>
          </div>
        )}

        {/* LAB RESULTS */}
        {activeTab === 'labs' && (
          <div>
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Lab Results</h3>
              <button onClick={() => setShowLabForm(!showLabForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
            </div>
            {showLabForm && (
              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input type="date" value={labForm.testDate} onChange={e => setLabForm({ ...labForm, testDate: e.target.value })} placeholder="Test Date" className="rounded border px-2 py-1.5 text-sm" />
                  <select value={labForm.category} onChange={e => setLabForm({ ...labForm, category: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
                    {['CBC','LFT','KFT','TUMOUR_MARKER','COAGULATION','URINE','OTHER'].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input placeholder="Test Name *" value={labForm.testName} onChange={e => setLabForm({ ...labForm, testName: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <input placeholder="Value" type="number" value={labForm.value} onChange={e => setLabForm({ ...labForm, value: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <input placeholder="Unit (e.g. g/dL)" value={labForm.unit} onChange={e => setLabForm({ ...labForm, unit: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <select value={labForm.flag} onChange={e => setLabForm({ ...labForm, flag: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
                    <option value="">Flag</option>
                    {['NORMAL','HIGH','LOW','CRITICAL'].map(f => <option key={f}>{f}</option>)}
                  </select>
                  <input placeholder="Ref Min" type="number" value={labForm.refMin} onChange={e => setLabForm({ ...labForm, refMin: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <input placeholder="Ref Max" type="number" value={labForm.refMax} onChange={e => setLabForm({ ...labForm, refMax: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <input placeholder="Notes" value={labForm.notes} onChange={e => setLabForm({ ...labForm, notes: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleAddLab} className="flex-1 rounded bg-indigo-600 py-1.5 text-sm font-semibold text-white">Save</button>
                  <button onClick={() => setShowLabForm(false)} className="flex-1 rounded bg-gray-300 py-1.5 text-sm">Cancel</button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2 pr-4">Date</th><th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Test</th><th className="pb-2 pr-4">Value</th>
                  <th className="pb-2 pr-4">Ref Range</th><th className="pb-2">Flag</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {labResults.map(l => (
                    <tr key={l.id} className={l.isAbnormal ? 'bg-red-50' : ''}>
                      <td className="py-2 pr-4 text-gray-500">{new Date(l.testDate).toLocaleDateString()}</td>
                      <td className="py-2 pr-4"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{l.category}</span></td>
                      <td className="py-2 pr-4 font-medium">{l.testName}</td>
                      <td className="py-2 pr-4">{l.value != null ? `${l.value} ${l.unit ?? ''}` : l.rawText ?? '—'}</td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">{l.refMin != null ? `${l.refMin}–${l.refMax} ${l.unit ?? ''}` : '—'}</td>
                      <td className="py-2">{l.flag ? <span className={`rounded px-2 py-0.5 text-xs ${FLAG_COLORS[l.flag] ?? 'bg-gray-100'}`}>{l.flag}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {labResults.length === 0 && <p className="mt-4 text-gray-400">No lab results yet.</p>}
            </div>
          </div>
        )}

        {/* IMAGING */}
        {activeTab === 'imaging' && (
          <div>
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Imaging Reports</h3>
              <button onClick={() => setShowImagingForm(!showImagingForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
            </div>
            {showImagingForm && (
              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input type="date" value={imagingForm.studyDate} onChange={e => setImagingForm({ ...imagingForm, studyDate: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <select value={imagingForm.modality} onChange={e => setImagingForm({ ...imagingForm, modality: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
                    {['CT','MRI','PET-CT','X-RAY','ULTRASOUND','BONE-SCAN','MAMMOGRAPHY'].map(m => <option key={m}>{m}</option>)}
                  </select>
                  <input placeholder="Body Part *" value={imagingForm.bodyPart} onChange={e => setImagingForm({ ...imagingForm, bodyPart: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <input placeholder="Indication" value={imagingForm.indication} onChange={e => setImagingForm({ ...imagingForm, indication: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-3" />
                  <textarea placeholder="Findings" value={imagingForm.findings} onChange={e => setImagingForm({ ...imagingForm, findings: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-3" rows={3} />
                  <textarea placeholder="Impression" value={imagingForm.impression} onChange={e => setImagingForm({ ...imagingForm, impression: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-3" rows={2} />
                  <select value={imagingForm.response} onChange={e => setImagingForm({ ...imagingForm, response: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
                    <option value="">RECIST Response</option>
                    {['CR','PR','SD','PD'].map(r => <option key={r}>{r}</option>)}
                  </select>
                  <input placeholder="Radiologist" value={imagingForm.radiologist} onChange={e => setImagingForm({ ...imagingForm, radiologist: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleAddImaging} className="flex-1 rounded bg-indigo-600 py-1.5 text-sm font-semibold text-white">Save</button>
                  <button onClick={() => setShowImagingForm(false)} className="flex-1 rounded bg-gray-300 py-1.5 text-sm">Cancel</button>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {imaging.map(r => (
                <div key={r.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">{r.modality}</span>
                      <span className="font-semibold text-gray-800">{r.bodyPart}</span>
                      {r.response && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.response === 'CR' ? 'bg-green-100 text-green-800' : r.response === 'PR' ? 'bg-teal-100 text-teal-800' : r.response === 'PD' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{r.response}</span>}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(r.studyDate).toLocaleDateString()}</span>
                  </div>
                  {r.impression && <p className="mt-2 text-sm text-gray-700"><b>Impression:</b> {r.impression}</p>}
                  {r.findings && <p className="mt-1 text-sm text-gray-500 line-clamp-3"><b>Findings:</b> {r.findings}</p>}
                  {r.radiologist && <p className="mt-1 text-xs text-gray-400">Dr. {r.radiologist}</p>}
                </div>
              ))}
              {imaging.length === 0 && <p className="text-gray-400">No imaging reports yet.</p>}
            </div>
          </div>
        )}

        {/* PATHOLOGY */}
        {activeTab === 'pathology' && (
          <div>
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Pathology Reports</h3>
              <button onClick={() => setShowPathForm(!showPathForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
            </div>
            {showPathForm && (
              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input type="date" value={pathForm.reportDate} onChange={e => setPathForm({ ...pathForm, reportDate: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <select value={pathForm.specimenType} onChange={e => setPathForm({ ...pathForm, specimenType: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
                    {['BIOPSY','SURGICAL','CYTOLOGY','BONE_MARROW','BLOOD'].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <input placeholder="Site *" value={pathForm.site} onChange={e => setPathForm({ ...pathForm, site: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <textarea placeholder="Diagnosis *" value={pathForm.diagnosis} onChange={e => setPathForm({ ...pathForm, diagnosis: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-3" rows={2} />
                  <input placeholder="Grade" value={pathForm.grade} onChange={e => setPathForm({ ...pathForm, grade: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <input placeholder="Stage (pT2N1M0)" value={pathForm.stage} onChange={e => setPathForm({ ...pathForm, stage: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <select value={pathForm.margins} onChange={e => setPathForm({ ...pathForm, margins: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
                    <option value="">Margins</option>
                    {['clear','involved','close'].map(m => <option key={m}>{m}</option>)}
                  </select>
                  <input placeholder="Pathologist" value={pathForm.pathologist} onChange={e => setPathForm({ ...pathForm, pathologist: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <input placeholder="Lab Name" value={pathForm.labName} onChange={e => setPathForm({ ...pathForm, labName: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleAddPath} className="flex-1 rounded bg-indigo-600 py-1.5 text-sm font-semibold text-white">Save</button>
                  <button onClick={() => setShowPathForm(false)} className="flex-1 rounded bg-gray-300 py-1.5 text-sm">Cancel</button>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {pathology.map(r => (
                <div key={r.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-800">{r.specimenType}</span>
                      <span className="font-semibold">{r.site}</span>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(r.reportDate).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-800">{r.diagnosis}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                    {r.grade && <span>Grade: {r.grade}</span>}
                    {r.stage && <span>Stage: {r.stage}</span>}
                    {r.margins && <span>Margins: {r.margins}</span>}
                  </div>
                  {r.ihcFindings && (
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-gray-600 mb-1">IHC:</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(r.ihcFindings).map(([k, v]) => (
                          <span key={k} className="rounded bg-gray-100 px-2 py-0.5 text-xs"><b>{k}:</b> {v as string}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {r.molecularTests && (
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-gray-600 mb-1">Molecular:</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(r.molecularTests).map(([k, v]) => (
                          <span key={k} className="rounded bg-yellow-50 px-2 py-0.5 text-xs border border-yellow-200"><b>{k}:</b> {v as string}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {pathology.length === 0 && <p className="text-gray-400">No pathology reports yet.</p>}
            </div>
          </div>
        )}

        {/* VITALS */}
        {activeTab === 'vitals' && (
          <div>
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Vital Signs</h3>
              <button onClick={() => setShowVitalsForm(!showVitalsForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
            </div>
            {showVitalsForm && (
              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {[['weight','Weight (kg)'],['height','Height (cm)'],['temperature','Temp (°C)'],['bpSystolic','BP Sys'],['bpDiastolic','BP Dia'],['pulseRate','Pulse/min'],['oxygenSat','SpO₂ %'],['ecogScore','ECOG 0-4'],['painScore','Pain 0-10']].map(([k, label]) => (
                    <input key={k} type="number" placeholder={label} value={(vitalsForm as any)[k]} onChange={e => setVitalsForm({ ...vitalsForm, [k]: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleAddVitals} className="flex-1 rounded bg-indigo-600 py-1.5 text-sm font-semibold text-white">Save</button>
                  <button onClick={() => setShowVitalsForm(false)} className="flex-1 rounded bg-gray-300 py-1.5 text-sm">Cancel</button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2 pr-3">Date</th><th className="pb-2 pr-3">Weight</th>
                  <th className="pb-2 pr-3">BP</th><th className="pb-2 pr-3">Pulse</th>
                  <th className="pb-2 pr-3">SpO₂</th><th className="pb-2 pr-3">Temp</th>
                  <th className="pb-2 pr-3">ECOG</th><th className="pb-2">Pain</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {vitals.map(v => (
                    <tr key={v.id}>
                      <td className="py-2 pr-3 text-gray-500 text-xs">{new Date(v.recordedAt).toLocaleDateString()}</td>
                      <td className="py-2 pr-3">{v.weight ? `${v.weight} kg` : '—'}</td>
                      <td className="py-2 pr-3">{v.bpSystolic ? `${v.bpSystolic}/${v.bpDiastolic}` : '—'}</td>
                      <td className="py-2 pr-3">{v.pulseRate ?? '—'}</td>
                      <td className="py-2 pr-3">{v.oxygenSat ? `${v.oxygenSat}%` : '—'}</td>
                      <td className="py-2 pr-3">{v.temperature ? `${v.temperature}°C` : '—'}</td>
                      <td className="py-2 pr-3">{v.ecogScore ?? '—'}</td>
                      <td className="py-2">{v.painScore ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {vitals.length === 0 && <p className="mt-4 text-gray-400">No vitals recorded yet.</p>}
            </div>
          </div>
        )}

        {/* CLINICAL NOTES */}
        {activeTab === 'notes' && (
          <div>
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Clinical Notes</h3>
              <button onClick={() => setShowNoteForm(!showNoteForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
            </div>
            {showNoteForm && (
              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select value={noteForm.noteType} onChange={e => setNoteForm({ ...noteForm, noteType: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
                    {['CONSULTATION','PROGRESS','DISCHARGE','MDT_DECISION','PROCEDURE','NURSING'].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input placeholder="Title *" value={noteForm.title} onChange={e => setNoteForm({ ...noteForm, title: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <input placeholder="Author Name *" value={noteForm.authorName} onChange={e => setNoteForm({ ...noteForm, authorName: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <select value={noteForm.authorRole} onChange={e => setNoteForm({ ...noteForm, authorRole: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
                    {['COORDINATOR','ONCOLOGIST','NURSE','SOCIAL_WORKER','DIETITIAN','PHARMACIST'].map(r => <option key={r}>{r}</option>)}
                  </select>
                  <textarea placeholder="Note content *" value={noteForm.content} onChange={e => setNoteForm({ ...noteForm, content: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" rows={5} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleAddNote} className="flex-1 rounded bg-indigo-600 py-1.5 text-sm font-semibold text-white">Save Note</button>
                  <button onClick={() => setShowNoteForm(false)} className="flex-1 rounded bg-gray-300 py-1.5 text-sm">Cancel</button>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {notes.map(n => (
                <div key={n.id} className="rounded-lg border-l-4 border-indigo-400 bg-gray-50 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 mr-2">{n.noteType.replace('_', ' ')}</span>
                      <span className="font-semibold text-gray-800">{n.title}</span>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(n.noteDate).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{n.content}</p>
                  <p className="mt-1 text-xs text-gray-400">{n.authorName} · {n.authorRole}</p>
                </div>
              ))}
              {notes.length === 0 && <p className="text-gray-400">No clinical notes yet.</p>}
            </div>
          </div>
        )}

        {/* DOCUMENTS */}
        {activeTab === 'documents' && (
          <div>
            <h3 className="font-semibold text-gray-800 mb-4">Patient Documents</h3>
            <div className="mb-4 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 p-4 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Document Title *" value={docTitle} onChange={e => setDocTitle(e.target.value)} className="rounded border px-2 py-1.5 text-sm col-span-2" />
                <select value={docCategory} onChange={e => setDocCategory(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
                  {['LAB_REPORT','IMAGING','PATHOLOGY','PRESCRIPTION','DISCHARGE_SUMMARY','CONSENT','INSURANCE','OTHER'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" className="hidden"
                onChange={e => e.target.files?.[0] && handleUploadDocument(e.target.files[0])} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingDoc || !docTitle}
                className="flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-400">
                <FiUpload /> {uploadingDoc ? 'Uploading...' : 'Choose & Upload File'}
              </button>
              <p className="text-xs text-gray-500">PDF, JPG, PNG, DOCX supported. Files stored with end-to-end privacy using signed URLs.</p>
            </div>
            <div className="space-y-3">
              {documents.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 mr-2">{d.category}</span>
                    <span className="font-medium text-gray-800">{d.title}</span>
                    <span className="ml-2 text-xs text-gray-400 uppercase">.{d.fileType}</span>
                    {d.fileSizeBytes && <span className="ml-2 text-xs text-gray-400">{(d.fileSizeBytes / 1024).toFixed(0)} KB</span>}
                    <div className="text-xs text-gray-400 mt-0.5">{new Date(d.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleExtractDocument(d.id)} title="Extract with AI" className="rounded p-1.5 text-purple-600 hover:bg-purple-50"><FiRefreshCw size={14} /></button>
                    <button onClick={() => handleDownloadDocument(d.id)} title="Download" className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50"><FiDownload size={14} /></button>
                    <button onClick={() => handleDeleteDocument(d.id)} title="Delete" className="rounded p-1.5 text-red-500 hover:bg-red-50"><FiTrash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {documents.length === 0 && <p className="text-gray-400">No documents uploaded yet.</p>}
            </div>
          </div>
        )}

        {/* CARE TEAM */}
        {activeTab === 'care-team' && (
          <div>
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Multidisciplinary Care Team</h3>
              <button onClick={() => setShowTeamForm(!showTeamForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add Member</button>
            </div>
            {showTeamForm && (
              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select value={teamForm.role} onChange={e => setTeamForm({ ...teamForm, role: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input placeholder="Full Name *" value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <input placeholder="Phone" value={teamForm.phone} onChange={e => setTeamForm({ ...teamForm, phone: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <input placeholder="Email" value={teamForm.email} onChange={e => setTeamForm({ ...teamForm, email: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
                  <input placeholder="Hospital / Department" value={teamForm.department} onChange={e => setTeamForm({ ...teamForm, department: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
                  <label className="flex items-center gap-2 text-sm col-span-2">
                    <input type="checkbox" checked={teamForm.isPrimary} onChange={e => setTeamForm({ ...teamForm, isPrimary: e.target.checked })} />
                    Primary contact for patient
                  </label>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleAddTeamMember} className="flex-1 rounded bg-indigo-600 py-1.5 text-sm font-semibold text-white">Add to Team</button>
                  <button onClick={() => setShowTeamForm(false)} className="flex-1 rounded bg-gray-300 py-1.5 text-sm">Cancel</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {careTeam.map(m => (
                <div key={m.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <FiUser className="text-indigo-500" />
                        <span className="font-semibold text-gray-800">{m.name}</span>
                        {m.isPrimary && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Primary</span>}
                      </div>
                      <div className="mt-1 text-sm text-indigo-600">{ROLE_LABELS[m.role] ?? m.role}</div>
                      {m.department && <div className="text-xs text-gray-500 mt-0.5">{m.department}</div>}
                      {m.phone && <div className="text-xs text-gray-500 mt-0.5">📞 {m.phone}</div>}
                      {m.email && <div className="text-xs text-gray-500">✉️ {m.email}</div>}
                    </div>
                    <button onClick={() => handleRemoveTeamMember(m.id)} className="text-red-400 hover:text-red-600 p-1"><FiTrash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {careTeam.length === 0 && <p className="text-gray-400 col-span-3">No care team members added yet.</p>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
