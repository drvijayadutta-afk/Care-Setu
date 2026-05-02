'use client';

import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { createClinicalNote, getPatientClinicalNotes, ClinicalNote } from '@/lib/api';

interface NotesTabProps {
  patientId: string;
  notes: ClinicalNote[];
  onNotesUpdate?: (notes: ClinicalNote[]) => void;
}

export function NotesTab({ patientId, notes, onNotesUpdate }: NotesTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ noteDate: new Date().toISOString().slice(0, 10), noteType: 'Progress', title: '', content: '', authorName: '', authorRole: '', isPrivate: false });

  const handleAdd = async () => {
    if (!form.title || !form.content || !form.authorName) return alert('Fill required fields');
    try {
      await createClinicalNote(patientId, {
        ...form,
        tags: [],
      });
      setForm({ noteDate: new Date().toISOString().slice(0, 10), noteType: 'Progress', title: '', content: '', authorName: '', authorRole: '', isPrivate: false });
      setShowForm(false);
      if (onNotesUpdate) {
        const updated = await getPatientClinicalNotes(patientId);
        onNotesUpdate(updated);
      }
    } catch { alert('Failed to create clinical note'); }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Clinical Notes</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> New</button>
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.noteDate} onChange={e => setForm({ ...form, noteDate: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <select value={form.noteType} onChange={e => setForm({ ...form, noteType: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
              {['Progress', 'Assessment', 'Plan', 'Consultation', 'Discharge'].map(t => <option key={t}>{t}</option>)}
            </select>
            <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
            <input placeholder="Author Name" value={form.authorName} onChange={e => setForm({ ...form, authorName: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
            <input placeholder="Author Role" value={form.authorRole} onChange={e => setForm({ ...form, authorRole: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
            <textarea placeholder="Note Content" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" rows={4} />
            <label className="flex items-center gap-2 col-span-2 text-sm"><input type="checkbox" checked={form.isPrivate} onChange={e => setForm({ ...form, isPrivate: e.target.checked })} /> Private Note</label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white">Create</button>
            <button onClick={() => setShowForm(false)} className="flex-1 rounded bg-gray-300 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {notes.map(n => (
          <div key={n.id} className="rounded border border-gray-200 p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold text-gray-800">{n.title}</div>
                <div className="text-xs text-gray-500">{n.authorName} • {n.noteType} {n.isPrivate && '(Private)'}</div>
              </div>
              <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.content}</p>
          </div>
        ))}
        {notes.length === 0 && <p className="text-gray-400">No clinical notes yet.</p>}
      </div>
    </div>
  );
}
