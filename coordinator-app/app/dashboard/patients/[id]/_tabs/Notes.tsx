'use client';

import { useState } from 'react';
import { FiPlus, FiLock, FiEdit3 } from 'react-icons/fi';
import { createClinicalNote, getPatientClinicalNotes, ClinicalNote } from '@/lib/api';
import { toast } from '@/lib/toast';

interface NotesTabProps {
  patientId: string;
  notes: ClinicalNote[];
  onNotesUpdate?: (notes: ClinicalNote[]) => void;
}

const NOTE_TYPES = [
  { value: 'Progress',     label: 'Progress Note — patient status since last visit' },
  { value: 'Assessment',   label: 'Assessment — clinical evaluation / findings' },
  { value: 'Plan',         label: 'Treatment Plan — planned interventions' },
  { value: 'Consultation', label: 'Consultation — specialist review / second opinion' },
  { value: 'Discharge',    label: 'Discharge Summary — end of treatment episode' },
  { value: 'Other',        label: 'Other' },
];

const EMPTY = {
  noteDate: new Date().toISOString().slice(0, 10),
  noteType: 'Progress',
  title: '',
  content: '',
  authorName: '',
  authorRole: '',
  isPrivate: false,
};

const inp = 'w-full rounded border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

export function NotesTab({ patientId, notes, onNotesUpdate }: NotesTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!form.title.trim()) {
      toast({ type: 'error', message: 'Please enter a title for this note' });
      return;
    }
    if (!form.content.trim()) {
      toast({ type: 'error', message: 'Note content cannot be empty' });
      return;
    }
    if (!form.authorName.trim()) {
      toast({ type: 'error', message: 'Please enter the name of the person writing this note' });
      return;
    }
    setSubmitting(true);
    try {
      await createClinicalNote(patientId, { ...form, tags: [] });
      setForm(EMPTY);
      setShowForm(false);
      toast({ type: 'success', message: 'Clinical note saved' });
      if (onNotesUpdate) {
        const updated = await getPatientClinicalNotes(patientId);
        onNotesUpdate(updated);
      }
    } catch {
      toast({ type: 'error', message: 'Could not save note — please try again' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800">Clinical Notes</h3>
          <p className="text-xs text-gray-500 mt-0.5">Progress notes, assessments, and clinical observations for this patient.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          <FiPlus size={14} /> Write Note
        </button>
      </div>

      {showForm && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <p className="text-xs text-indigo-700 font-medium">Fields marked * are required.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Date *</label>
              <input type="date" value={form.noteDate}
                onChange={e => setForm({ ...form, noteDate: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Note Type *</label>
              <select value={form.noteType}
                onChange={e => setForm({ ...form, noteType: e.target.value })}
                className={inp}>
                {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Note Title *</label>
              <input placeholder="e.g. Cycle 3 chemotherapy — post-treatment review"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Written by (name) *</label>
              <input placeholder="e.g. Dr. Anita Sharma"
                value={form.authorName}
                onChange={e => setForm({ ...form, authorName: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Role / Designation</label>
              <input placeholder="e.g. Medical Oncologist, Oncology Nurse"
                value={form.authorRole}
                onChange={e => setForm({ ...form, authorRole: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Note Content *</label>
              <textarea
                placeholder="Write the clinical note here. Include observations, patient complaints, examination findings, or any relevant clinical information."
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                className={inp} rows={5} />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.isPrivate}
                  onChange={e => setForm({ ...form, isPrivate: e.target.checked })}
                  className="rounded" />
                <span>
                  <strong>Private Note</strong>
                  <span className="text-gray-500 font-normal"> — visible only to the coordinating team, not shared with the patient</span>
                </span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={submitting}
              className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Note'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={submitting}
              className="flex-1 rounded border border-gray-300 bg-white py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {notes.map(n => {
          const noteTypeLabel = NOTE_TYPES.find(t => t.value === n.noteType)?.value ?? n.noteType;
          return (
            <div key={n.id} className={`rounded-lg border p-4 ${n.isPrivate ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-gray-800">{n.title}</div>
                    {n.isPrivate && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <FiLock size={10} /> Private
                      </span>
                    )}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {noteTypeLabel}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {n.authorName}{n.authorRole ? ` · ${n.authorRole}` : ''}
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
                  {new Date(n.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-3 mt-1">
                {n.content}
              </p>
            </div>
          );
        })}

        {notes.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <FiEdit3 size={24} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm font-medium">No clinical notes yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Click <strong>Write Note</strong> to add a progress note, assessment, or treatment plan for this patient.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
