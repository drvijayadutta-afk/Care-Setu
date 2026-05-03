'use client';

import { useState, useMemo } from 'react';
import { FiPlus, FiCalendar, FiCheckCircle, FiAlertCircle, FiActivity, FiRefreshCw, FiX, FiUsers, FiMessageCircle, FiPrinter } from 'react-icons/fi';
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

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  scheduled:    { label: 'Scheduled',    cls: 'bg-blue-100 text-blue-800' },
  'in-progress':{ label: 'In Progress',  cls: 'bg-yellow-100 text-yellow-800' },
  completed:    { label: 'Completed',    cls: 'bg-gray-100 text-gray-700' },
  cancelled:    { label: 'Cancelled',    cls: 'bg-red-100 text-red-700' },
};

const SYMPTOM_LABELS: Record<string, string> = {
  fatigue: 'Fatigue', nausea: 'Nausea', vomiting: 'Vomiting', pain: 'Pain',
  fever: 'Fever', diarrhoea: 'Diarrhoea', constipation: 'Constipation',
  appetite_loss: 'Loss of Appetite', weakness: 'Weakness', breathlessness: 'Breathlessness',
  mouth_sores: 'Mouth Sores', hair_loss: 'Hair Loss', skin_rash: 'Skin Rash',
  numbness: 'Numbness / Tingling', swelling: 'Swelling',
};

function symptomLabel(s: string) {
  return SYMPTOM_LABELS[s.toLowerCase()] ?? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const inp = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

export function TumorBoardTab({
  patientId, meetings, checkins, conversations, labResults, imaging, pathology, onMeetingsUpdate,
}: TumorBoardTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', scheduledAt: '', mode: 'sync',
    // structured agenda fields
    clinicalQuestion: '',
    currentProtocol: '',
    optionA: '', optionB: '', optionC: '',
    discussionMinutes: '10',
    openQuestions: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [decisionForm, setDecisionForm] = useState({
    treatment: '', protocol: '', nextReview: '', notes: '', meetingNotes: '',
  });

  const selectedMeeting = useMemo(
    () => meetings.find(m => m.id === selectedId) || null,
    [meetings, selectedId]
  );

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
    if (!form.title.trim()) {
      toast({ type: 'error', message: 'Please enter a title for this meeting' });
      return;
    }
    if (!form.scheduledAt) {
      toast({ type: 'error', message: 'Please select the date and time of the meeting' });
      return;
    }
    setSubmitting(true);
    try {
      // Build structured agenda text from the form fields
      const agendaSections: string[] = [];
      if (form.clinicalQuestion) agendaSections.push(`Clinical Question:\n${form.clinicalQuestion}`);
      if (form.currentProtocol) agendaSections.push(`Current Protocol / Treatment:\n${form.currentProtocol}`);
      // Auto-append abnormal labs summary
      if (criticalLabs.length > 0 || abnormalLabs.length > 0) {
        const labSummary = [...criticalLabs, ...abnormalLabs]
          .map(l => `  • ${l.testName}: ${l.value} ${l.unit ?? ''} [${l.flag}]`)
          .join('\n');
        agendaSections.push(`Labs to Review:\n${labSummary}`);
      }
      if (latestImaging) {
        agendaSections.push(`Imaging:\n  • ${latestImaging.modality} of ${latestImaging.bodyPart} (${new Date(latestImaging.studyDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`);
      }
      if (latestPathology) {
        agendaSections.push(`Pathology:\n  • ${latestPathology.diagnosis} — ${latestPathology.site} (${latestPathology.specimenType})`);
      }
      // Patient symptom summary
      if (recentCheckins.length > 0) {
        const scores = recentCheckins.map(c => (c as any).score).join(', ');
        const lowCount = recentCheckins.filter(c => (c as any).score <= 2).length;
        let symptomLine = `Symptom Burden (last ${recentCheckins.length} check-ins):\n  • Wellbeing scores: ${scores}/5`;
        if (lowCount > 0) symptomLine += `\n  • ⚠ ${lowCount} low-score day(s) — patient distressed`;
        if (uniqueSymptoms.length > 0) symptomLine += `\n  • Reported: ${uniqueSymptoms.map(s => symptomLabel(s as string)).join(', ')}`;
        agendaSections.push(symptomLine);
      }
      if (form.optionA || form.optionB || form.optionC) {
        const opts = [
          form.optionA ? `  A) ${form.optionA}` : null,
          form.optionB ? `  B) ${form.optionB}` : null,
          form.optionC ? `  C) ${form.optionC}` : null,
        ].filter(Boolean).join('\n');
        agendaSections.push(`Treatment Options to Consider:\n${opts}`);
      }
      if (form.openQuestions) agendaSections.push(`Open Questions / Carry-Forward:\n${form.openQuestions}`);
      agendaSections.push(`Estimated Discussion Time: ${form.discussionMinutes} minutes`);

      const agenda = agendaSections.join('\n\n');

      const created = await createTumorBoardMeeting(patientId, {
        title: form.title.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        mode: form.mode,
        agenda: agenda || undefined,
      });
      onMeetingsUpdate([created, ...meetings]);
      setShowCreate(false);
      setForm({ title: '', scheduledAt: '', mode: 'sync', clinicalQuestion: '', currentProtocol: '', optionA: '', optionB: '', optionC: '', discussionMinutes: '10', openQuestions: '' });
      toast({ type: 'success', message: 'Tumor board meeting scheduled — care team members will be invited automatically' });
    } catch {
      toast({ type: 'error', message: 'Could not schedule meeting — please try again' });
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
      toast({ type: 'success', message: 'MDT brief generated and saved to this meeting' });
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Could not generate brief — please try again in a moment';
      toast({ type: 'error', message: msg });
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
      toast({ type: 'success', message: 'Decision saved and meeting marked as completed' });
    } catch {
      toast({ type: 'error', message: 'Could not save decision — please try again' });
    }
  };

  const handleSignOff = async (participantId: string, current: boolean) => {
    if (!selectedMeeting) return;
    try {
      const updated = await signOffParticipant(selectedMeeting.id, participantId, !current);
      const meeting = {
        ...selectedMeeting,
        participants: selectedMeeting.participants.map(p => p.id === participantId ? updated : p),
      };
      onMeetingsUpdate(meetings.map(m => m.id === meeting.id ? meeting : m));
    } catch {
      toast({ type: 'error', message: 'Could not update sign-off — please try again' });
    }
  };

  // Patient context data (Care Setu's competitive advantage — no other MDT platform has this)
  const recentCheckins = checkins.slice(0, 7);
  const recentSymptoms = recentCheckins.flatMap(c => (c as any).symptoms || []).filter(Boolean);
  const uniqueSymptoms = Array.from(new Set(recentSymptoms)).slice(0, 10);
  const lastPatientMsg = conversations.find(c => c.role === 'patient');
  const lastContactAgo = lastPatientMsg
    ? Math.round((Date.now() - new Date(lastPatientMsg.createdAt).getTime()) / 3600000)
    : null;
  const criticalLabs = labResults.filter(l => l.flag === 'CRITICAL').slice(0, 4);
  const abnormalLabs = labResults.filter(l => l.flag && l.flag !== 'NORMAL' && l.flag !== 'CRITICAL').slice(0, 3);
  const latestImaging = imaging[0];
  const latestPathology = pathology[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tumor Board / MDT Meetings</h3>
          <p className="text-sm text-gray-500">
            Schedule multidisciplinary team meetings, capture treatment decisions, and review patient-reported symptoms alongside clinical data.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 flex-shrink-0"
        >
          <FiPlus size={14} /> Schedule Meeting
        </button>
      </div>

      {/* Create meeting form */}
      {showCreate && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-indigo-900">New Tumor Board Meeting — Agenda Builder</h4>
              <p className="text-xs text-indigo-600 mt-0.5">Labs, imaging, and patient symptoms are auto-populated from the patient record.</p>
            </div>
            <button onClick={() => setShowCreate(false)} className="text-indigo-600 hover:text-indigo-900"><FiX size={18} /></button>
          </div>

          {/* ── Section 1: Meeting basics ── */}
          <div className="rounded-lg bg-white border border-indigo-100 p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Meeting Details</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Meeting Title *</label>
              <input
                type="text"
                placeholder="e.g. Oncology MDT — Breast Cancer Cases, Weekly GI Tumor Board"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">Date &amp; Time *</label>
                <input type="datetime-local" value={form.scheduledAt}
                  onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
                  className={inp} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">Meeting Format</label>
                <select value={form.mode}
                  onChange={e => setForm({ ...form, mode: e.target.value })}
                  className={inp}>
                  <option value="sync">In-person / Live video meeting</option>
                  <option value="async">Asynchronous (online, no fixed time)</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 2: Clinical question & protocol ── */}
          <div className="rounded-lg bg-white border border-indigo-100 p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Clinical Context</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Clinical Question for the Board *
                <span className="text-gray-400 font-normal ml-1">— the specific decision this meeting should answer</span>
              </label>
              <textarea
                placeholder="e.g. Decide surgery timing after Cycle 2 FOLFOX. Is the response sufficient for resection? Address Grade 3 peripheral neuropathy."
                value={form.clinicalQuestion}
                onChange={e => setForm({ ...form, clinicalQuestion: e.target.value })}
                rows={2}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Current Protocol / Treatment
                <span className="text-gray-400 font-normal ml-1">— what the patient is currently on</span>
              </label>
              <input
                placeholder="e.g. FOLFOX Cycle 3/6, AC-T Cycle 4/8, Radiation 50 Gy in 25 fractions"
                value={form.currentProtocol}
                onChange={e => setForm({ ...form, currentProtocol: e.target.value })}
                className={inp} />
            </div>
          </div>

          {/* ── Section 3: Auto-populated clinical data ── */}
          {(criticalLabs.length > 0 || abnormalLabs.length > 0 || latestImaging || latestPathology || recentCheckins.length > 0) && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Auto-Populated from Patient Record</p>
              <p className="text-[10px] text-amber-600">This data will be included in the agenda automatically — no need to type it again.</p>
              {(criticalLabs.length > 0 || abnormalLabs.length > 0) && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-0.5">Labs to Review</p>
                  <div className="space-y-0.5">
                    {[...criticalLabs, ...abnormalLabs].map(l => (
                      <div key={l.id} className={`text-xs ${l.flag === 'CRITICAL' ? 'text-red-700 font-semibold' : 'text-amber-800'}`}>
                        • {l.testName}: {l.value} {l.unit} [{l.flag}]
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {latestImaging && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-0.5">Latest Imaging</p>
                  <p className="text-xs text-gray-600">• {latestImaging.modality} of {latestImaging.bodyPart}</p>
                </div>
              )}
              {latestPathology && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-0.5">Latest Pathology</p>
                  <p className="text-xs text-gray-600">• {latestPathology.diagnosis} — {latestPathology.site}</p>
                </div>
              )}
              {recentCheckins.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-0.5">Patient Symptom Burden</p>
                  <p className="text-xs text-gray-600">
                    • Last {recentCheckins.length} check-in scores: {recentCheckins.map(c => (c as any).score).join(', ')}/5
                    {recentCheckins.filter(c => (c as any).score <= 2).length > 0 && (
                      <span className="text-red-600 ml-1">⚠ distress detected</span>
                    )}
                  </p>
                  {uniqueSymptoms.length > 0 && (
                    <p className="text-xs text-gray-600">• Reported: {uniqueSymptoms.map(s => symptomLabel(s as string)).join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Section 4: Treatment options ── */}
          <div className="rounded-lg bg-white border border-indigo-100 p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Treatment Options to Consider
              <span className="text-gray-400 font-normal normal-case ml-1 tracking-normal">— for the board to debate (optional)</span>
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Option A</label>
              <input placeholder="e.g. Continue FOLFOX for 2 more cycles then re-assess" value={form.optionA}
                onChange={e => setForm({ ...form, optionA: e.target.value })} className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Option B</label>
              <input placeholder="e.g. Proceed to surgical resection after Cycle 3" value={form.optionB}
                onChange={e => setForm({ ...form, optionB: e.target.value })} className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Option C (if applicable)</label>
              <input placeholder="e.g. Switch to palliative intent — FOLFIRI" value={form.optionC}
                onChange={e => setForm({ ...form, optionC: e.target.value })} className={inp} />
            </div>
          </div>

          {/* ── Section 5: Open questions & time ── */}
          <div className="rounded-lg bg-white border border-indigo-100 p-3 space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Open Questions / Carry-Forward from Previous Meeting
              </label>
              <textarea
                placeholder="Any unresolved questions from last time, or new questions to address"
                value={form.openQuestions}
                onChange={e => setForm({ ...form, openQuestions: e.target.value })}
                rows={2}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Estimated Discussion Time</label>
              <select value={form.discussionMinutes}
                onChange={e => setForm({ ...form, discussionMinutes: e.target.value })}
                className={inp}>
                {['5', '10', '15', '20', '30', '45', '60'].map(t => (
                  <option key={t} value={t}>{t} minutes</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={submitting}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400">
              {submitting ? 'Scheduling…' : 'Schedule Meeting & Build Agenda'}
            </button>
            <button onClick={() => setShowCreate(false)} disabled={submitting}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Meeting list */}
      {meetings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <FiCalendar size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm font-medium">No tumor board meetings scheduled yet.</p>
          <p className="text-gray-400 text-xs mt-1">
            When you schedule a meeting, all active care team members will be invited automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map(m => {
            const cfg = STATUS_CONFIG[m.status] ?? { label: m.status, cls: 'bg-gray-100 text-gray-700' };
            const signedCount = m.participants.filter(p => p.signedOff).length;
            return (
              <button
                key={m.id}
                onClick={() => openMeeting(m)}
                className={`w-full text-left rounded-lg border p-4 transition-colors ${
                  selectedId === m.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-indigo-50 p-2 text-indigo-600">
                      <FiCalendar size={14} />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{m.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(m.scheduledAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {m.participants.length > 0 && ` · ${m.participants.length} participants`}
                        {signedCount > 0 && ` · ${signedCount}/${m.participants.length} signed off`}
                        {m.mode === 'async' && ' · Asynchronous'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {m.consensusReached && (
                      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        <FiCheckCircle size={11} /> Decision recorded
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected meeting — two-column detail view */}
      {selectedMeeting && (
        <div className="rounded-xl border-2 border-indigo-200 bg-white overflow-hidden mt-4">
          <div className="flex items-center justify-between border-b border-indigo-100 px-5 py-3 bg-indigo-50">
            <div>
              <h4 className="font-semibold text-gray-900">{selectedMeeting.title}</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {new Date(selectedMeeting.scheduledAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {selectedMeeting.mode === 'async' && ' · Asynchronous'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const w = window.open('', '_blank');
                  if (!w) return;
                  const agenda = selectedMeeting.agenda || 'No agenda recorded.';
                  const brief = selectedMeeting.briefText || '';
                  const decision = selectedMeeting.decision;
                  w.document.write(`<!DOCTYPE html><html><head><title>${selectedMeeting.title}</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#111}
h1{font-size:18px;margin-bottom:4px}h2{font-size:13px;color:#6366f1;margin:20px 0 6px;border-bottom:1px solid #e0e0e0;padding-bottom:3px}
pre{white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.6;background:#f9f9f9;padding:12px;border-radius:4px}
.meta{font-size:12px;color:#666;margin-bottom:24px}@media print{body{margin:20px}}</style></head><body>
<h1>${selectedMeeting.title}</h1>
<div class="meta">
Scheduled: ${new Date(selectedMeeting.scheduledAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}<br>
Mode: ${selectedMeeting.mode === 'async' ? 'Asynchronous' : 'In-person / Live'}<br>
Participants: ${selectedMeeting.participants.map(p => `${p.name} (${formatRole(p.role)})`).join(', ') || 'None'}
</div>
<h2>AGENDA</h2><pre>${agenda}</pre>
${brief ? `<h2>MDT BRIEF</h2><pre>${brief}</pre>` : ''}
${decision?.treatment ? `<h2>DECISION</h2><pre>Treatment: ${decision.treatment}\nProtocol: ${decision.protocol || '—'}\nNext Review: ${decision.nextReview || '—'}\nNotes: ${decision.notes || '—'}</pre>` : ''}
</body></html>`);
                  w.document.close();
                  setTimeout(() => w.print(), 300);
                }}
                className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                title="Print or save as PDF"
              >
                <FiPrinter size={12} /> Print Agenda
              </button>
              <button onClick={() => setSelectedId(null)} className="text-gray-500 hover:text-gray-700 p-1">
                <FiX size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
            {/* LEFT — Patient context (exclusive to Care Setu) */}
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <FiActivity size={14} className="text-amber-600" />
                <span className="text-xs font-bold uppercase tracking-wide text-gray-700">Patient Context</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 font-medium">Care Setu exclusive</span>
              </div>
              <p className="text-xs text-gray-500">
                Patient-reported data from WhatsApp — not available in any other MDT platform. Shows how the patient has been feeling between clinic visits.
              </p>

              {/* Last contact */}
              {lastContactAgo !== null && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                  <FiMessageCircle size={13} className="text-gray-500" />
                  <span className="text-gray-600">
                    Last WhatsApp message from patient:{' '}
                    <strong>{lastContactAgo < 1 ? 'less than 1 hour ago' : `${lastContactAgo} hours ago`}</strong>
                  </span>
                </div>
              )}

              {/* Recent check-ins */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <div className="text-xs font-semibold text-amber-900 mb-2">
                  Recent Self-Reports (last {recentCheckins.length} check-ins)
                </div>
                {recentCheckins.length === 0 ? (
                  <p className="text-xs text-amber-700">No check-ins received yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentCheckins.map(c => {
                      const score = (c as any).score as number;
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <span className="text-amber-900">
                            Wellbeing score: <strong>{score}/5</strong>
                            {score <= 2 && <span className="ml-1 text-red-600 font-semibold">⚠ Low</span>}
                          </span>
                          <span className="text-amber-600">
                            {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reported symptoms */}
              {uniqueSymptoms.length > 0 && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                  <div className="text-xs font-semibold text-orange-900 mb-2">Reported Symptoms (last 7 check-ins)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueSymptoms.map((s, i) => (
                      <span key={i} className="rounded-full bg-orange-100 border border-orange-200 px-2.5 py-0.5 text-xs text-orange-800">
                        {symptomLabel(s as string)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Critical labs */}
              {criticalLabs.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FiAlertCircle size={13} className="text-red-700" />
                    <span className="text-xs font-semibold text-red-900">Critical Lab Values — Needs Immediate Review</span>
                  </div>
                  <div className="space-y-1">
                    {criticalLabs.map(l => (
                      <div key={l.id} className="text-xs text-red-800">
                        <strong>{l.testName}:</strong> {l.value} {l.unit}
                        {l.refMin != null && l.refMax != null && (
                          <span className="text-red-600"> (Normal: {l.refMin}–{l.refMax} {l.unit})</span>
                        )}
                        <span className="text-red-600 ml-1">
                          — {new Date(l.testDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Abnormal (non-critical) labs */}
              {abnormalLabs.length > 0 && criticalLabs.length === 0 && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                  <div className="text-xs font-semibold text-orange-900 mb-1">Abnormal Lab Values</div>
                  <div className="space-y-0.5">
                    {abnormalLabs.map(l => (
                      <div key={l.id} className="text-xs text-orange-800">
                        {l.testName}: {l.value} {l.unit} ({l.flag === 'HIGH' ? '↑ High' : '↓ Low'})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Latest imaging */}
              {latestImaging && (
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-xs">
                  <div className="font-semibold text-purple-900 mb-1">Latest Imaging</div>
                  <div className="text-purple-800">
                    {latestImaging.modality} of {latestImaging.bodyPart}
                    {' · '}
                    {new Date(latestImaging.studyDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  {latestImaging.impression && (
                    <p className="text-purple-700 mt-1 italic leading-relaxed">
                      "{latestImaging.impression.slice(0, 150)}{latestImaging.impression.length > 150 ? '…' : ''}"
                    </p>
                  )}
                </div>
              )}

              {/* Latest pathology */}
              {latestPathology && (
                <div className="rounded-lg bg-pink-50 border border-pink-200 p-3 text-xs">
                  <div className="font-semibold text-pink-900 mb-1">Latest Pathology Report</div>
                  <div className="text-pink-800">
                    {latestPathology.diagnosis}
                    {latestPathology.grade && ` · Grade: ${latestPathology.grade}`}
                    {latestPathology.stage && ` · Stage: ${latestPathology.stage}`}
                  </div>
                  <div className="text-pink-700">{latestPathology.site} · {latestPathology.specimenType}</div>
                </div>
              )}

              {recentCheckins.length === 0 && uniqueSymptoms.length === 0 && criticalLabs.length === 0 && !latestImaging && !latestPathology && (
                <p className="text-sm text-gray-400 italic text-center py-4">
                  Patient data will appear here once labs, imaging, and check-ins are added.
                </p>
              )}
            </div>

            {/* RIGHT — MDT workflow */}
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <FiUsers size={14} className="text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wide text-gray-700">MDT Workflow</span>
              </div>

              {/* Participants & sign-off */}
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">
                  Participants ({selectedMeeting.participants.length})
                  {selectedMeeting.participants.length > 0 && (
                    <span className="text-gray-400 font-normal ml-1">
                      — {selectedMeeting.participants.filter(p => p.signedOff).length}/{selectedMeeting.participants.length} signed off
                    </span>
                  )}
                </div>
                {selectedMeeting.participants.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No participants yet. Add care team members in the Care Team tab — they'll be included in future meetings automatically.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedMeeting.participants.map(p => (
                      <div key={p.id} className="flex items-center justify-between rounded bg-gray-50 px-2.5 py-2">
                        <div>
                          <div className="text-xs font-semibold text-gray-900">{p.name}</div>
                          <div className="text-xs text-gray-500">{formatRole(p.role)}</div>
                        </div>
                        <button
                          onClick={() => handleSignOff(p.id, p.signedOff)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            p.signedOff
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          {p.signedOff ? '✓ Signed off' : 'Mark as signed off'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Structured Agenda */}
              {selectedMeeting.agenda && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs font-semibold text-amber-900 mb-2">Meeting Agenda</div>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-amber-800 leading-relaxed max-h-40 overflow-y-auto">
                    {selectedMeeting.agenda}
                  </pre>
                </div>
              )}

              {/* AI Brief */}
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-700">AI-Generated MDT Brief</div>
                    <div className="text-xs text-gray-400">A structured clinical summary for the tumor board discussion.</div>
                  </div>
                  <button
                    onClick={handleGenerateBrief}
                    disabled={briefLoading}
                    className="flex items-center gap-1.5 rounded bg-purple-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:bg-gray-400 whitespace-nowrap"
                  >
                    <FiRefreshCw size={11} className={briefLoading ? 'animate-spin' : ''} />
                    {briefLoading ? 'Generating…' : selectedMeeting.briefText ? 'Regenerate Brief' : 'Generate Brief'}
                  </button>
                </div>
                {selectedMeeting.briefText ? (
                  <pre className="whitespace-pre-wrap rounded bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 max-h-48 overflow-y-auto font-sans leading-relaxed">
                    {selectedMeeting.briefText}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-3">
                    Click <strong>Generate Brief</strong> to create a structured clinical summary for this meeting from all patient records.
                  </p>
                )}
              </div>

              {/* Decision capture */}
              <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                <div>
                  <div className="text-xs font-semibold text-gray-700">Treatment Decision</div>
                  <div className="text-xs text-gray-400">Record the team's consensus decision from this meeting.</div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Treatment Recommendation</label>
                  <input type="text"
                    placeholder="e.g. Proceed with surgery, Continue FOLFOX for 4 more cycles, Switch to palliative RT"
                    value={decisionForm.treatment}
                    onChange={e => setDecisionForm({ ...decisionForm, treatment: e.target.value })}
                    className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Protocol / Regimen</label>
                  <input type="text"
                    placeholder="e.g. FOLFOX, AC-T, Radiation 50 Gy in 25 fractions, Palliative intent"
                    value={decisionForm.protocol}
                    onChange={e => setDecisionForm({ ...decisionForm, protocol: e.target.value })}
                    className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Next Review / Follow-up</label>
                  <input type="text"
                    placeholder="e.g. After Cycle 4, in 6 weeks, post-surgery review"
                    value={decisionForm.nextReview}
                    onChange={e => setDecisionForm({ ...decisionForm, nextReview: e.target.value })}
                    className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Decision Rationale / Notes</label>
                  <textarea
                    placeholder="Why was this decision made? Any dissenting views, conditions, or caveats?"
                    value={decisionForm.notes}
                    onChange={e => setDecisionForm({ ...decisionForm, notes: e.target.value })}
                    rows={2}
                    className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">General Meeting Notes</label>
                  <textarea
                    placeholder="Any other important points raised during the meeting"
                    value={decisionForm.meetingNotes}
                    onChange={e => setDecisionForm({ ...decisionForm, meetingNotes: e.target.value })}
                    rows={2}
                    className={inp} />
                </div>
                <button
                  onClick={handleSaveDecision}
                  className="w-full rounded bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Save Decision &amp; Mark Meeting as Completed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
