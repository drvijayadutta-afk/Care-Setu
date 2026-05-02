'use client';

import { FiPlus } from 'react-icons/fi';
import { PathologyReport } from '@/lib/api';

interface PathologyTabProps {
  patientId: string;
  pathology: PathologyReport[];
}

export function PathologyTab({ patientId, pathology }: PathologyTabProps) {
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Pathology</h3>
        <button className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
      </div>
      <div className="space-y-2">
        {pathology.map(p => (
          <div key={p.id} className="rounded border border-gray-200 p-3">
            <div className="font-semibold text-sm">{p.diagnosis}</div>
            <div className="text-xs text-gray-500">{p.site} • {new Date(p.reportDate).toLocaleDateString()}</div>
            {p.grade && <div className="text-xs text-gray-600 mt-1">Grade: {p.grade}</div>}
          </div>
        ))}
        {pathology.length === 0 && <p className="text-gray-400">No pathology reports yet.</p>}
      </div>
    </div>
  );
}
