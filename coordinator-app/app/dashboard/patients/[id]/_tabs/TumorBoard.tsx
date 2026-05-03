'use client';

import { useState, useMemo } from 'react';
import { FiPlus, FiCalendar, FiCheckCircle, FiAlertCircle, FiActivity, FiFileText, FiRefreshCw, FiX } from 'react-icons/fi';
import {
  TumorBoardMeeting, createTumorBoardMeeting, updateTumorBoardMeeting,
  signOffParticipant, generateMeetingBrief,
  Checkin, Conversation, LabResult, ImagingReport, PathologyReport,
} from '@/lib/api';
import { toast } from '@/lib/toast';

interface TumorBoardTabProps {
  patientId: string;
  meetings: TumorBoardMeeting[];
  checkins: Checkin[];
  conversations: Conversation[];
  labResults: LabResult[];
  imaging: ImagingReport[];
  pathology: PathologyReport[];
  onMeetingsUpdate: (meetings: TumorBoardMeeting[]) => void;
}

export function TumorBoardTab({
  patientId, meetings, checkins, conversations, labResults, imaging, pathology, onMeetingsUpdate,
}: TumorBoardTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', scheduledAt: '', mode: 'sync', agenda: '' });
  const [submitting, setSubmitting] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [decisionForm, setDecisionForm] = useState<{ treatment: string; protocol: string; nextReview: string; notes: string; meetingNotes: string }>({
    treatment: '', protocol: '', nextReview: '', notes: '', meetingNotes: '',
  });

  const selectedMeeting = useMemo(
    () => meetings.find(m => m.id === selectedId) || null,
    [meetings, selectedId]
  );

  // Hydrate decision form when a meeting is opened
  const openMeeting = (m: TumorBoardMeeting) => {
    setSelectedId(m.id);
    setDecisionForm({
      treatment: m.decision?.treatment || '',
      protocol: m.decision?.protocol || '',
      nextReview: m.decision?.nextReview || '',
      notes: m.decision?.notes || '',
      meetingNotes: m.meetingNotes || '',
    });
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.scheduledAt) {
      toast({ type: 'error', message: 'Title and date are required' });
      return;
    }
    setSubmitting(true);
    try {
      const created = await createTumorBoardMeeting(patientId, {
        title: form.title.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        mode: form.mode,
        agenda: form.agenda || undefined,
      });
      onMeetingsUpdate([created, ...meetings]);
      setShowCreate(false);
      setForm({ title: '', scheduledAt: '', mode: 'sync', agenda: '' });
      toast({ type: 'success', message: 'Tumor board meeting scheduled' });
    } catch {
      toast({ type: 'error', message: 'Failed to schedule meeting' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateBrief = async () => {
    if (!selectedMeeting) return;
    setBriefLoading(true);
    try {
      const { briefText } = await generateMeetingBrief(selectedMeeting.id);
      const updated = meetings.map(m => m.id === selectedMeeting.id ? { ...m, briefText } : m);
      onMeetingsUpdate(updated);
      toast({ type: 'success', message: 'AI brief generated' });
    } catch {
      toast({ type: 'error', message: 'Failed to generate brief' });
    } finally {
      setBriefLoading(false);
    }
  };

  const handleSaveDecision = async () => {
    if (!selectedMeeting) return;
    try {
      const updated = await updateTumorBoardMeeting(selectedMeeting.id, {
        decision: {
          treatment: decisionForm.treatment,
          protocol: decisionForm.protocol,
          nextReview: decisionForm.nextReview,
          notes: decisionForm.notes,
        },
        meetingNotes: decisionForm.meetingNotes,
        consensusReached: !!decisionForm.treatment,
        status: 'completed',
      });
      onMeetingsUpdate(meetings.map(m => m.id === updated.id ? updated : m));
      toast({ type: 'success', message: 'Decision saved' });
    } catch {
      toast({ type: 'error', message: 'Failed to save decision' });
    }
  };

  const handleSignOff = async (participantId: string, current: boolean) => {
    if (!selectedMeeting) return;
    try {
      const updated = await signOffParticipant(selectedMeeting.id, participantId, !current);
      const meeting = { ...selectedMeeting, participants: selectedMeeting.participants.map(p => p.id === participantId ? updated : p) };
      onMeetingsUpdate(meetings.map(m => m.id === meeting.id ? meeting : m));
    } catch {
      toast({ type: 'error', message: 'Failed to update sign-off' });
    }
  };

  // ─── Patient context (the unique Care Setu data — competitors don't have this) ───
  const recentCheckins = checkins.slice(0, 5);
  const recentSymptoms = recentCheckins.flatMap(c => c.symptoms || []).slice(0, 8);
  const lastWhatsAppMsg = conversations.find(c => c.role === 'patient');
  const lastContactAgo = lastWhatsAppMsg
    ? Math.round((Date.now() - new Date(lastWhatsAppMsg.createdAt).getTime()) / 3600000)
    : null;
  const criticalLabs = labResults.filter(l => l.flag === 'CRITICAL').slice(0, 3);
  const latestImaging = imaging[0];
  const latestPathology = pathology[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tumor Board / MDT</h3>
          <p className="text-sm text-gray-500">Schedule meetings, capture decisions, and surface patient-reported context that no other MDT platform shows</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <FiPlus size={14} /> Schedule Meeting
        </button>
      </div>

      {/* Schedule form */}
      {showCreate && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-indigo-900">New Tumor Board Meeting</h4>
            <button onClick={() => setShowCreate(false)} className="text-indigo-700 hover:text-indigo-900"><FiX size={18} /></button>
          </div>
          <input
            type="text"
            placeholder="Meeting title (e.g., Weekly GI MDT — Patient Mitchell)"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={form.mode}
              onChange={e => setForm({ ...form, mode: e.target.value })}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="sync">Synchronous (live meeting)</option>
              <option value="async">Asynchronous (comment-based)</option>
            </select>
          </div>
          <textarea
            placeholder="Agenda / questions for the board (optional)"
            value={form.agenda}
            onChange={e => setForm({ ...form, agenda: e.target.value })}
            rows={2}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {submitting ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      )}

      {/* Meeting list */}
      {meetings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <FiCalendar size={32} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500">No tumor board meetings scheduled yet.</p>
          <p className="text-xs text-gray-400 mt-1">Active care team members will be auto-invited when you schedule one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map(m => (
            <button
              key={m.id}
              onClick={() => openMeeting(m)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                selectedId === m.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{m.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(m.scheduledAt).toLocaleString()} · {m.participants.length} participants · {m.mode}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.consensusReached && (
                    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      <FiCheckCircle size={11} /> Consensus
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                    m.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    m.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>{m.status}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected meeting detail — two-column layout */}
      {selectedMeeting && (
        <div className="rounded-lg border-2 border-indigo-200 bg-white p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">{selectedMeeting.title}</h4>
            <button onClick={() => setSelectedId(null)} className="text-gray-500 hover:text-gray-700"><FiX size={18} /></button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT — Patient context (Care Setu's competitive edge) */}
            <div className="space-y-3">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FiActivity className="text-amber-700" size={14} />
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-900">Patient self-reports (last 5 check-ins)</span>
                </div>
                {recentCheckins.length === 0 ? (
                  <p className="text-xs text-amber-700">No recent check-ins.</p>
                ) : (
                  <div className="space-y-1 text-xs">
                    {recentCheckins.map(c => (
                      <div key={c.id} className="flex items-center justify-between">
                        <span className="text-amber-900">
                          Score {c.score}/10 · Day {c.cycleDay}
                          {c.symptoms?.length ? ` · ${c.symptoms.slice(0, 3).join(', ')}` : ''}
                        </span>
                        <span className="text-amber-600">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                {lastContactAgo !== null && (
                  <p className="text-xs text-amber-700 mt-2 italic">
                    Last patient message: {lastContactAgo < 1 ? 'just now' : `${lastContactAgo}h ago`}
                  </p>
                )}
              </div>

              {recentSymptoms.length > 0 && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-orange-900 mb-1">Reported symptoms (rolling)</div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(recentSymptoms)).map((s, i) => (
                      <span key={i} className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {criticalLabs.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <FiAlertCircle className="text-red-700" size={14} />
                    <span className="text-xs font-bold uppercase tracking-wide text-red-900">Critical labs</span>
                  </div>
                  <div className="space-y-0.5 text-xs">
                    {criticalLabs.map(l => (
                      <div key={l.id} className="text-red-800">
                        {l.testName}: {l.value} {l.unit} ({new Date(l.testDate).toLocaleDateString()})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {latestImaging && (
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-xs">
                  <div className="font-bold uppercase tracking-wide text-purple-900 mb-1">Latest imaging</div>
                  <div className="text-purple-800">
                    {latestImaging.modality} of {latestImaging.bodyPart} · {new Date(latestImaging.studyDate).toLocaleDateString()}
                    {latestImaging.response && <span className="ml-1 font-medium">[RECIST: {latestImaging.response}]</span>}
                  </div>
                  {latestImaging.impression && <div className="text-purple-700 mt-1 italic">"{latestImaging.impression.slice(0, 120)}{latestImaging.impression.length > 120 ? '…' : ''}"</div>}
                </div>
              )}

              {latestPathology && (
                <div className="rounded-lg bg-pink-50 border border-pink-200 p-3 text-xs">
                  <div className="font-bold uppercase tracking-wide text-pink-900 mb-1">Latest pathology</div>
                  <div className="text-pink-800">{latestPathology.diagnosis} · {latestPathology.specimenType} · {latestPathology.site}</div>
                </div>
              )}

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-xs italic text-blue-800">
                💡 The above data comes from the patient's WhatsApp check-ins — a Care Setu exclusive that no other MDT platform offers.
              </div>
            </div>

            {/* RIGHT — MDT workflow */}
            <div className="space-y-3">
              {/* Participants */}
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-2">Participants ({selectedMeeting.participants.length})</div>
                <div className="space-y-1">
                  {selectedMeeting.participants.length === 0 ? (
                    <p className="text-xs text-gray-500">No participants. Add care team members in the Care Team tab first.</p>
                  ) : selectedMeeting.participants.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1.5 text-xs">
                      <div>
                        <div className="font-medium text-gray-900">{p.name}</div>
                        <div className="text-gray-500">{p.role.replace(/_/g, ' ').toLowerCase()}</div>
                      </div>
                      <button
                        onClick={() => handleSignOff(p.id, p.signedOff)}
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          p.signedOff ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {p.signedOff ? '✓ Signed off' : 'Sign off'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Brief */}
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-700">AI MDT Brief</div>
                  <button
                    onClick={handleGenerateBrief}
                    disabled={briefLoading}
                    className="flex items-center gap-1 rounded bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:bg-gray-400"
                  >
                    <FiRefreshCw className={briefLoading ? 'animate-spin' : ''} size={11} />
                    {briefLoading ? 'Generating…' : (selectedMeeting.briefText ? 'Regenerate' : 'Generate')}
                  </button>
                </div>
                {selectedMeeting.briefText ? (
                  <pre className="whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700 max-h-48 overflow-y-auto font-sans leading-relaxed">
                    {selectedMeeting.briefText}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-500 italic">No brief yet. Click Generate to snapshot the patient's full MDT-ready summary.</p>
                )}
              </div>

              {/* Decision capture */}
              <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-700">MDT Decision</div>
                <input
                  type="text"
                  placeholder="Treatment recommendation"
                  value={decisionForm.treatment}
                  onChange={e => setDecisionForm({ ...decisionForm, treatment: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Protocol (e.g., FOLFOX, AC-T, RT 50Gy)"
                  value={decisionForm.protocol}
                  onChange={e => setDecisionForm({ ...decisionForm, protocol: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Next review (e.g., after 2 cycles)"
                  value={decisionForm.nextReview}
                  onChange={e => setDecisionForm({ ...decisionForm, nextReview: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
                <textarea
                  placeholder="Decision notes / rationale"
                  value={decisionForm.notes}
                  onChange={e => setDecisionForm({ ...decisionForm, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
                <textarea
                  placeholder="General meeting notes"
                  value={decisionForm.meetingNotes}
                  onChange={e => setDecisionForm({ ...decisionForm, meetingNotes: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
                <button
                  onClick={handleSaveDecision}
                  className="w-full rounded bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Save Decision & Mark Completed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
