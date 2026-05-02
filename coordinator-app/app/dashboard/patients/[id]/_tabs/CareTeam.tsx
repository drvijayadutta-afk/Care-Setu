'use client';

import { useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { addCareTeamMember, removeCareTeamMember, getCareTeam, CareTeamMember } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/recordRegistry';

interface CareTeamTabProps {
  patientId: string;
  careTeam: CareTeamMember[];
  onCareTeamUpdate?: (careTeam: CareTeamMember[]) => void;
}

export function CareTeamTab({ patientId, careTeam, onCareTeamUpdate }: CareTeamTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ role: 'MEDICAL_ONCOLOGIST', name: '', phone: '', email: '', isPrimary: false, isActive: true });

  const handleAdd = async () => {
    if (!form.name) return alert('Fill required fields');
    try {
      await addCareTeamMember(patientId, form);
      setForm({ role: 'MEDICAL_ONCOLOGIST', name: '', phone: '', email: '', isPrimary: false, isActive: true });
      setShowForm(false);
      if (onCareTeamUpdate) {
        const updated = await getCareTeam(patientId);
        onCareTeamUpdate(updated);
      }
    } catch { alert('Failed to add care team member'); }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this member from care team?')) return;
    try {
      await removeCareTeamMember(memberId);
      if (onCareTeamUpdate) {
        const updated = await getCareTeam(patientId);
        onCareTeamUpdate(updated);
      }
    } catch { alert('Failed to remove care team member'); }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Care Team</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add Member</button>
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2">
              {Object.keys(ROLE_LABELS).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
            <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <label className="flex items-center gap-2 col-span-2 text-sm"><input type="checkbox" checked={form.isPrimary} onChange={e => setForm({ ...form, isPrimary: e.target.checked })} /> Primary Contact</label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white">Add</button>
            <button onClick={() => setShowForm(false)} className="flex-1 rounded bg-gray-300 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {careTeam.map(m => (
          <div key={m.id} className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold text-gray-800">{m.name}</div>
                <div className="text-xs text-indigo-600">{ROLE_LABELS[m.role] ?? m.role}</div>
                {m.isPrimary && <div className="text-xs font-semibold text-indigo-700">Primary</div>}
              </div>
              <button onClick={() => handleRemove(m.id)} className="text-gray-400 hover:text-red-600"><FiTrash2 size={16} /></button>
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
