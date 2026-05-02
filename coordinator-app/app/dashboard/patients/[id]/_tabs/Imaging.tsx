'use client';

import { FiPlus } from 'react-icons/fi';
import { ImagingReport } from '@/lib/api';

interface ImagingTabProps {
  patientId: string;
  imaging: ImagingReport[];
}

export function ImagingTab({ patientId, imaging }: ImagingTabProps) {
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Imaging</h3>
        <button className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
      </div>
      <div className="space-y-2">
        {imaging.map(i => (
          <div key={i.id} className="rounded border border-gray-200 p-3">
            <div className="font-semibold text-sm">{i.modality}</div>
            <div className="text-xs text-gray-500">{i.bodyPart} • {new Date(i.studyDate).toLocaleDateString()}</div>
            {i.findings && <p className="mt-1 text-sm text-gray-700">{i.findings}</p>}
          </div>
        ))}
        {imaging.length === 0 && <p className="text-gray-400">No imaging reports yet.</p>}
      </div>
    </div>
  );
}
