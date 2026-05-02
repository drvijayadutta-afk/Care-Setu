'use client';

import { FiPlus } from 'react-icons/fi';
import { VitalSign } from '@/lib/api';

interface VitalsTabProps {
  patientId: string;
  vitals: VitalSign[];
}

export function VitalsTab({ patientId, vitals }: VitalsTabProps) {
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Vitals</h3>
        <button className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
      </div>
      <div className="space-y-3">
        {vitals.map(v => (
          <div key={v.id} className="rounded border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-2">{new Date(v.createdAt).toLocaleDateString()}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {v.weight && <div><span className="text-gray-600">Weight:</span> <span className="font-semibold">{v.weight} kg</span></div>}
              {v.height && <div><span className="text-gray-600">Height:</span> <span className="font-semibold">{v.height} cm</span></div>}
              {v.bpSystolic && <div><span className="text-gray-600">BP:</span> <span className="font-semibold">{v.bpSystolic}/{v.bpDiastolic}</span></div>}
              {v.pulseRate && <div><span className="text-gray-600">Pulse:</span> <span className="font-semibold">{v.pulseRate}</span></div>}
            </div>
          </div>
        ))}
        {vitals.length === 0 && <p className="text-gray-400">No vital signs recorded yet.</p>}
      </div>
    </div>
  );
}
