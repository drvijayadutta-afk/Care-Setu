'use client';

import { useState } from 'react';
import { FiGitBranch, FiPlus, FiSearch, FiCheck, FiX, FiEye } from 'react-icons/fi';
import {
  getPatientReferrals, createReferral, updateReferralStatus,
  getDoctors, Referral, Doctor
} from '@/lib/api';
import { toast } from '@/lib/toast';

const STATUS_CHIPS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  accepted:  'bg-blue-100 text-blue-800',
  seen:      'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  declined:  'bg-red-100 text-red-800',
};

const URGENCY_CHIPS: Record<string, string> = {
  routine:   'bg-gray-100 text-gray-600',
  urgent:    'bg-orange-100 text-orange-700',
  emergency: 'bg-red-100 text-red-800 font-bold',
};

interface Props {
  patientId: string;
  referrals: Referral[];
}

export function ReferralsTab({ patientId, referrals: initial }: Props) {
  const [referrals, setReferrals] = useState<Referral[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [form, setForm] = useState({ toDoctorId: '', reason: '', urgency: 'routine', clinicalContext: '' });
  const [saving, setSaving] = useState(false);

  const openForm = async () => {
    if (!doctors.length) {
      try { const d = await getDoctors(); setDoctors(d); } catch {}
    }
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.toDoctorId || !form.reason) return;
    setSaving(true);
    try {
      const referral = await createReferral(patientId, form);
      setReferrals(prev => [referral, ...prev]);
      setShowForm(false);
      setForm({ toDoctorId: '', reason: '', urgency: 'routine', clinicalContext: '' });
      toast({ type: 'success', message: 'Referral created and doctor notified' });
    } catch (e: any) {
      toast({ type: 'error', message: e?.response?.data?.error || 'Failed to create referral' });
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (referralId: string, status: string) => {
    try {
      const updated = await updateReferralStatus(referralId, status);
      setReferrals(prev => prev.map(r => r.id === referralId ? updated : r));
      toast({ type: 'success', message: `Referral marked as ${status}` });
    } catch {
      toast({ type: 'error', message: 'Failed to update status' });
    }
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

  const filteredDoctors = doctors.filter(d =>
    d.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
    d.specialization.toLowerCase().includes(doctorSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Referrals</h3>
          <p className="text-xs text-gray-500 mt-0.5">{referrals.length} referral{referrals.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openForm} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">
          <FiPlus size={13} /> Create Referral
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <h4 className="font-semibold text-indigo-900">New Referral</h4>

          {/* Doctor search */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Refer to Doctor *</label>
            <div className="relative mb-2">
              <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                value={doctorSearch} onChange={e => setDoctorSearch(e.target.value)}
                placeholder="Search doctor name or specialization…"
                className="w-full rounded border border-gray-300 pl-7 pr-3 py-1.5 text-sm"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded border border-gray-200 bg-white divide-y divide-gray-100">
              {filteredDoctors.slice(0, 10).map(d => (
                <button
                  key={d.id} type="button"
                  onClick={() => { setForm(f => ({ ...f, toDoctorId: d.id })); setDoctorSearch(`Dr. ${d.name} — ${d.specialization}`); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 ${form.toDoctorId === d.id ? 'bg-indigo-50 font-semibold' : ''}`}
                >
                  Dr. {d.name} <span className="text-gray-400">· {d.specialization} · {d.hospitalName}</span>
                </button>
              ))}
              {filteredDoctors.length === 0 && <p className="p-3 text-sm text-gray-400">No doctors found</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Urgency</label>
              <select
                value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason *</label>
              <input
                value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Clinical Context (optional)</label>
            <textarea
              value={form.clinicalContext} onChange={e => setForm(f => ({ ...f, clinicalContext: e.target.value }))}
              rows={2}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Relevant history, findings, or questions for the receiving doctor…"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving || !form.toDoctorId || !form.reason}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-400">
              {saving ? 'Creating…' : 'Create Referral'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Referral timeline */}
      {referrals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">
          <FiGitBranch size={24} className="mx-auto mb-2 opacity-40" />
          No referrals yet
        </div>
      ) : (
        <div className="space-y-3">
          {referrals.map(r => (
            <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-800">
                    Dr. {r.toDoctor?.name ?? r.toDoctorId}
                    {r.toDoctor?.specialization && <span className="ml-1 text-sm font-normal text-indigo-600">· {r.toDoctor.specialization}</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">From: {r.fromCoordinator?.name ?? 'Coordinator'} · {fmt(r.createdAt)}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${URGENCY_CHIPS[r.urgency] ?? ''}`}>{r.urgency}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CHIPS[r.status] ?? ''}`}>{r.status}</span>
                </div>
              </div>

              <p className="mt-2 text-sm text-gray-700">{r.reason}</p>
              {r.clinicalContext && <p className="mt-1 text-xs text-gray-500 italic">{r.clinicalContext}</p>}

              {/* Timeline */}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
                {r.acceptedAt  && <span className="flex items-center gap-1 text-blue-600"><FiCheck size={11} /> Accepted {fmt(r.acceptedAt)}</span>}
                {r.seenAt      && <span className="flex items-center gap-1 text-indigo-600"><FiEye size={11} /> Seen {fmt(r.seenAt)}</span>}
                {r.completedAt && <span className="flex items-center gap-1 text-green-600"><FiCheck size={11} /> Completed {fmt(r.completedAt)}</span>}
                {r.declinedAt  && <span className="flex items-center gap-1 text-red-600"><FiX size={11} /> Declined {fmt(r.declinedAt)}</span>}
              </div>
              {r.declineReason && <p className="mt-1 text-xs text-red-500">Reason: {r.declineReason}</p>}
              {r.notificationSent && <span className="mt-1 block text-xs text-green-600">✓ Doctor notified via WhatsApp</span>}

              {/* Quick actions */}
              {r.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => handleStatus(r.id, 'accepted')} className="rounded-lg bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">Accept</button>
                  <button onClick={() => handleStatus(r.id, 'declined')} className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50">Decline</button>
                </div>
              )}
              {r.status === 'accepted' && (
                <button onClick={() => handleStatus(r.id, 'seen')} className="mt-3 rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700">Mark Seen</button>
              )}
              {r.status === 'seen' && (
                <button onClick={() => handleStatus(r.id, 'completed')} className="mt-3 rounded-lg bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">Mark Completed</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
