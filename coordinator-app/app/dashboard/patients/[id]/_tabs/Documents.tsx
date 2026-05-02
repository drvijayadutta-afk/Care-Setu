'use client';

import { FiPlus, FiDownload, FiTrash2 } from 'react-icons/fi';
import { PatientDocument } from '@/lib/api';

interface DocumentsTabProps {
  patientId: string;
  documents: PatientDocument[];
}

export function DocumentsTab({ patientId, documents }: DocumentsTabProps) {
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Documents</h3>
        <button className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Upload</button>
      </div>
      <div className="space-y-2">
        {documents.map(d => (
          <div key={d.id} className="flex items-center justify-between rounded border border-gray-200 p-3">
            <div className="text-sm">
              <div className="font-semibold text-gray-800">{d.title}</div>
              <div className="text-xs text-gray-500">{d.category} • {new Date(d.uploadedAt).toLocaleDateString()}</div>
            </div>
            <div className="flex gap-2">
              <button className="p-1 text-gray-500 hover:text-indigo-600"><FiDownload size={16} /></button>
              <button className="p-1 text-gray-500 hover:text-red-600"><FiTrash2 size={16} /></button>
            </div>
          </div>
        ))}
        {documents.length === 0 && <p className="text-gray-400">No documents uploaded yet.</p>}
      </div>
    </div>
  );
}
