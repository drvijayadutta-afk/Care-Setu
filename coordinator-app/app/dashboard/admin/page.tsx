'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FiSettings, FiUsers, FiUserPlus, FiHeart, FiBell, FiArrowRight,
  FiCheckCircle, FiMessageCircle, FiActivity, FiClipboard, FiTrendingUp,
} from 'react-icons/fi';
import { useCoordinatorStore } from '@/lib/store';
import { getPatients, Patient } from '@/lib/api';

export default function AdminPage() {
  const router = useRouter();
  const { coordinatorRole, coordinatorName } = useCoordinatorStore();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  // Gate: ADMIN only
  useEffect(() => {
    if (coordinatorRole && coordinatorRole !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [coordinatorRole, router]);

  useEffect(() => {
    getPatients()
      .then(p => setPatients(Array.isArray(p) ? p : []))
      .finally(() => setLoading(false));
  }, []);

  if (coordinatorRole && coordinatorRole !== 'ADMIN') return null;

  const totalPatients = patients.length;
  const onboarded = patients.filter(p => p.onboardingStep >= 9).length;
  const inProgress = totalPatients - onboarded;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FiSettings className="text-indigo-600" size={28} />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hospital Admin</h1>
          <p className="text-sm text-gray-500">Manage your hospital's Care Setu deployment</p>
        </div>
      </div>

      {/* Hero — Positioning statement */}
      <div className="rounded-lg bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-lg">
        <h2 className="text-xl font-bold mb-2">The patient-first cancer coordination platform</h2>
        <p className="text-indigo-100 mb-4 leading-relaxed">
          Bringing tumor board to where patients and doctors already are. Unlike traditional MDT software
          that stops at the meeting room, Care Setu connects every patient symptom, every report, and
          every care team decision into one continuous loop.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/10 backdrop-blur rounded p-3">
            <FiMessageCircle className="mb-1" size={16} />
            <div className="text-xs font-semibold">Patient WhatsApp</div>
            <div className="text-xs text-indigo-100">Reach patients where they are</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded p-3">
            <FiHeart className="mb-1" size={16} />
            <div className="text-xs font-semibold">Caregiver inclusion</div>
            <div className="text-xs text-indigo-100">Family in the loop</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded p-3">
            <FiActivity className="mb-1" size={16} />
            <div className="text-xs font-semibold">Symptom → MDT</div>
            <div className="text-xs text-indigo-100">Live data feeds tumor board</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded p-3">
            <FiClipboard className="mb-1" size={16} />
            <div className="text-xs font-semibold">AI extraction</div>
            <div className="text-xs text-indigo-100">PDFs to structured records</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Total Patients</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{loading ? '—' : totalPatients}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
            <FiCheckCircle size={12} /> Onboarded
          </div>
          <div className="text-3xl font-bold text-green-600 mt-1">{loading ? '—' : onboarded}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide">In Progress</div>
          <div className="text-3xl font-bold text-amber-600 mt-1">{loading ? '—' : inProgress}</div>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/admin/outcomes"
          className="group bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow border border-transparent hover:border-indigo-200"
        >
          <div className="flex items-start justify-between">
            <div>
              <FiTrendingUp className="text-indigo-600 mb-2" size={24} />
              <h3 className="font-semibold text-gray-900 mb-1">Outcome Dashboard</h3>
              <p className="text-sm text-gray-500">Aggregate clinical metrics — check-in trends, symptom burden, alert rates, MDT activity. CSV export for NABH reports.</p>
            </div>
            <FiArrowRight className="text-gray-400 group-hover:text-indigo-600" size={18} />
          </div>
        </Link>

        <Link
          href="/dashboard/patients/new"
          className="group bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow border border-transparent hover:border-indigo-200"
        >
          <div className="flex items-start justify-between">
            <div>
              <FiUserPlus className="text-indigo-600 mb-2" size={24} />
              <h3 className="font-semibold text-gray-900 mb-1">Add Patient</h3>
              <p className="text-sm text-gray-500">Register a new patient manually — for clinic walk-ins, referrals, or patients without WhatsApp.</p>
            </div>
            <FiArrowRight className="text-gray-400 group-hover:text-indigo-600" size={18} />
          </div>
        </Link>

        <div className="bg-white rounded-lg shadow p-5 opacity-70">
          <div className="flex items-start justify-between">
            <div>
              <FiUsers className="text-gray-400 mb-2" size={24} />
              <h3 className="font-semibold text-gray-700 mb-1">Coordinator Management</h3>
              <p className="text-sm text-gray-500">Invite coordinators, set roles, manage access. Coming in next release.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5 opacity-70">
          <div className="flex items-start justify-between">
            <div>
              <FiBell className="text-gray-400 mb-2" size={24} />
              <h3 className="font-semibold text-gray-700 mb-1">Notification Preferences</h3>
              <p className="text-sm text-gray-500">Control which events trigger WhatsApp alerts to care teams. Coming in next release.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5 opacity-70">
          <div className="flex items-start justify-between">
            <div>
              <FiSettings className="text-gray-400 mb-2" size={24} />
              <h3 className="font-semibold text-gray-700 mb-1">Hospital Settings</h3>
              <p className="text-sm text-gray-500">Hospital name, departments, contact info, branding. Coming in next release.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Patient roster */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200 px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Patient Roster</h3>
          <span className="text-xs text-gray-500">{patients.length} patients</span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">Loading…</div>
        ) : patients.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">No patients yet. Click "Add Patient" above to register the first one.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {patients.slice(0, 20).map(p => (
              <Link
                key={p.id}
                href={`/dashboard/patients/${p.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium text-gray-900">{p.name || 'Unnamed'}</div>
                  <div className="text-xs text-gray-500">{p.cancerType} · {p.hospitalName}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  p.onboardingStep >= 9 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {p.onboardingStep >= 9 ? 'Onboarded' : 'In Progress'}
                </span>
              </Link>
            ))}
            {patients.length > 20 && (
              <div className="px-5 py-3 text-xs text-gray-500 text-center">
                Showing first 20. <Link href="/dashboard/patients" className="text-indigo-600 hover:text-indigo-800">View all</Link>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 text-center pt-4">
        Logged in as <strong>{coordinatorName}</strong> (Hospital Admin)
      </div>
    </div>
  );
}
