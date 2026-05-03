'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiGitBranch, FiSearch, FiFilter, FiCheck, FiX, FiEye } from 'react-icons/fi';
import { getAllReferrals, updateReferralStatus, Referral } from '@/lib/api';
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

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAllReferrals()
      .then(setReferrals)
      .catch(() => toast({ type: 'error', message: 'Failed to load referrals' }))
      .finally(() => setLoading(false));
  }, []);

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

  const filtered = referrals.filter(r => {
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesUrgency = !urgencyFilter || r.urgency === urgencyFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      r.patient?.name?.toLowerCase().includes(q) ||
      r.toDoctor?.name?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q);
    return matchesStatus && matchesUrgency && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Referrals</h1>
          <p className="text-sm text-gray-500 mt-0.5">{referrals.length} total referrals</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, doctor, reason…"
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-4 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <FiFilter size={14} className="text-gray-400" />
          <select
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="seen">Seen</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
          </select>
          <select
            value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">All urgencies</option>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
      </div>

      {/* Referral list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <FiGitBranch size={28} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">No referrals found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/dashboard/patients/${r.patientId}`}
                      className="font-semibold text-gray-900 hover:text-indigo-600"
                    >
                      {r.patient?.name ?? r.patientId}
                    </Link>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-indigo-700">
                      Dr. {r.toDoctor?.name ?? r.toDoctorId}
                      {r.toDoctor?.specialization && (
                        <span className="ml-1 text-sm font-normal text-gray-500">· {r.toDoctor.specialization}</span>
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    From: {r.fromCoordinator?.name ?? 'Coordinator'} · {fmt(r.createdAt)}
                    {r.toDoctor?.hospitalName && <span> · {r.toDoctor.hospitalName}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${URGENCY_CHIPS[r.urgency] ?? ''}`}>
                    {r.urgency}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CHIPS[r.status] ?? ''}`}>
                    {r.status}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-700">{r.reason}</p>
              {r.clinicalContext && (
                <p className="text-xs text-gray-500 italic">{r.clinicalContext}</p>
              )}

              {/* Timeline */}
              <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                {r.acceptedAt  && <span className="flex items-center gap-1 text-blue-600"><FiCheck size={11} /> Accepted {fmt(r.acceptedAt)}</span>}
                {r.seenAt      && <span className="flex items-center gap-1 text-indigo-600"><FiEye size={11} /> Seen {fmt(r.seenAt)}</span>}
                {r.completedAt && <span className="flex items-center gap-1 text-green-600"><FiCheck size={11} /> Completed {fmt(r.completedAt)}</span>}
                {r.declinedAt  && <span className="flex items-center gap-1 text-red-600"><FiX size={11} /> Declined {fmt(r.declinedAt)}</span>}
              </div>
              {r.declineReason && <p className="text-xs text-red-500">Decline reason: {r.declineReason}</p>}

              {/* Quick actions */}
              <div className="flex gap-2 pt-1">
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => handleStatus(r.id, 'accepted')} className="rounded-lg bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">Accept</button>
                    <button onClick={() => handleStatus(r.id, 'declined')} className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50">Decline</button>
                  </>
                )}
                {r.status === 'accepted' && (
                  <button onClick={() => handleStatus(r.id, 'seen')} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700">Mark Seen</button>
                )}
                {r.status === 'seen' && (
                  <button onClick={() => handleStatus(r.id, 'completed')} className="rounded-lg bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">Mark Completed</button>
                )}
                <Link
                  href={`/dashboard/patients/${r.patientId}`}
                  className="ml-auto rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  View Patient
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
