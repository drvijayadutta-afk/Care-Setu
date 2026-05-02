'use client';

import { FiPlus } from 'react-icons/fi';
import { ClinicalNote } from '@/lib/api';

interface NotesTabProps {
  patientId: string;
  notes: ClinicalNote[];
}

export function NotesTab({ patientId, notes }: NotesTabProps) {
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Clinical Notes</h3>
        <button className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> New</button>
      </div>
      <div className="space-y-3">
        {notes.map(n => (
          <div key={n.id} className="rounded border border-gray-200 p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="font-semibold text-gray-800">{n.title}</div>
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
