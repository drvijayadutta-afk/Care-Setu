'use client';

import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { CareTeamMember } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/recordRegistry';

interface CareTeamTabProps {
  patientId: string;
  careTeam: CareTeamMember[];
}

export function CareTeamTab({ patientId, careTeam }: CareTeamTabProps) {
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Care Team</h3>
        <button className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add Member</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {careTeam.map(m => (
          <div key={m.id} className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold text-gray-800">{m.name}</div>
                <div className="text-xs text-indigo-600">{ROLE_LABELS[m.role] ?? m.role}</div>
              </div>
              <button className="text-gray-400 hover:text-red-600"><FiTrash2 size={16} /></button>
            </div>
            {m.email && <div className="text-xs text-gray-600">{m.email}</div>}
            {m.phone && <div className="text-xs text-gray-600">{m.phone}</div>}
          </div>
        ))}
        {careTeam.length === 0 && <p className="text-gray-400 col-span-2">No care team members added yet.</p>}
      </div>
    </div>
  );
}
