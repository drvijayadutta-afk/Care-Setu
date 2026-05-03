'use client';

import { useState } from 'react';
import { FiPlus, FiTrash2, FiUser, FiPhone, FiMail } from 'react-icons/fi';
import { addCareTeamMember, removeCareTeamMember, getCareTeam, CareTeamMember } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/recordRegistry';
import { toast } from '@/lib/toast';

interface CareTeamTabProps {
  patientId: string;
  careTeam: CareTeamMember[];
  onCareTeamUpdate?: (careTeam: CareTeamMember[]) => void;
}

const ROLE_ORDER = [
  'MEDICAL_ONCOLOGIST', 'SURGICAL_ONCOLOGIST', 'RADIATION_ONCOLOGIST',
  'PATHOLOGIST', 'RADIOLOGIST', 'PALLIATIVE_CARE',
  'ONCOLOGY_NURSE', 'COORDINATOR', 'NUTRITIONIST', 'PHYSIOTHERAPIST', 'OTHER',
];

const inp = 'w-full rounded border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

export function CareTeamTab({ patientId, careTeam, onCareTeamUpdate }: CareTeamTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ role: 'MEDICAL_ONCOLOGIST', name: '', phone: '', email: '', isPrimary: false, isActive: true });
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast({ type: 'error', message: 'Please enter the care team member\'s name' });
      return;
    }
    setSubmitting(true);
    try {
      await addCareTeamMember(patientId, form);
      setForm({ role: 'MEDICAL_ONCOLOGIST', name: '', phone: '', email: '', isPrimary: false, isActive: true });
      setShowForm(false);
      toast({ type: 'success', message: 'Care team member added' });
      if (onCareTeamUpdate) {
        const updated = await getCareTeam(patientId);
        onCareTeamUpdate(updated);
      }
    } catch {
      toast({ type: 'error', message: 'Could not add member — please try again' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (member: CareTeamMember) => {
    setRemovingId(member.id);
    try {
      await removeCareTeamMember(member.id);
      toast({ type: 'success', message: `${member.name} removed from care team` });
      if (onCareTeamUpdate) {
        const updated = await getCareTeam(patientId);
        onCareTeamUpdate(updated);
      }
    } catch {
      toast({ type: 'error', message: 'Could not remove member — please try again' });
    } finally {
      setRemovingId(null);
    }
  };

  const sortedRoles = [...ROLE_ORDER.filter(r => Object.keys(ROLE_LABELS).includes(r)), ...Object.keys(ROLE_LABELS).filter(r => !ROLE_ORDER.includes(r))];

  return (
    <div>
      <div className="flex justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800">Care Team</h3>
          <p className="text-xs text-gray-500 mt-0.5">The multidisciplinary team involved in this patient's care.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          <FiPlus size={14} /> Add Member
        </button>
      </div>

      {showForm && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <p className="text-xs text-indigo-700 font-medium">Fields marked * are required.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Role / Specialisation *</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inp}>
                {sortedRoles.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Full Name *</label>
              <input placeholder="e.g. Dr. Anita Sharma" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Email Address</label>
              <input placeholder="e.g. anita.sharma@hospital.com" type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Phone / WhatsApp Number</label>
              <input placeholder="e.g. +91 98765 43210" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.isPrimary}
                  onChange={e => setForm({ ...form, isPrimary: e.target.checked })}
                  className="rounded" />
                <span>
                  Mark as <strong>Primary Contact</strong>
                  <span className="text-gray-500 font-normal"> — this person will receive priority alerts for this patient</span>
                </span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={submitting}
              className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Member'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={submitting}
              className="flex-1 rounded border border-gray-300 bg-white py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {careTeam.map(m => (
          <div key={m.id} className={`rounded-lg border p-4 ${m.isPrimary ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <FiUser size={18} />
                </div>
                <div>
                  <div className="font-semibold text-gray-800">{m.name}</div>
                  <div className="text-xs text-indigo-700 font-medium mt-0.5">{ROLE_LABELS[m.role] ?? m.role}</div>
                  {m.isPrimary && (
                    <span className="inline-block mt-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                      Primary Contact
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRemove(m)}
                disabled={removingId === m.id}
                className="ml-2 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                title="Remove from care team"
              >
                <FiTrash2 size={15} />
              </button>
            </div>
            {(m.email || m.phone) && (
              <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
                {m.email && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <FiMail size={11} /> {m.email}
                  </div>
                )}
                {m.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <FiPhone size={11} /> {m.phone}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {careTeam.length === 0 && (
          <div className="col-span-2 rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <FiUser size={24} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm font-medium">No care team members added yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Add the oncologist, nurse, and other specialists involved in this patient's treatment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
