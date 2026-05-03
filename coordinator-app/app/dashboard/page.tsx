'use client';

import { useEffect, useState, useMemo } from 'react';
import { getPatients, Patient, healthCheck } from '@/lib/api';
import { useCoordinatorStore } from '@/lib/store';
import Link from 'next/link';
import { FiAlertCircle, FiCheckCircle, FiClock, FiSearch, FiUserPlus } from 'react-icons/fi';

type FilterMode = 'all' | 'onboarded' | 'in-progress';

export default function DashboardPage() {
  const { setPatients, coordinatorRole } = useCoordinatorStore();
  const isAdmin = coordinatorRole === 'ADMIN';
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        const online = await healthCheck();
        setServerOnline(online);

        if (!online) {
          setError('Backend server is not running. Start it with: npm run dev');
          setLoading(false);
          return;
        }

        const data = await getPatients();
        const patients = Array.isArray(data) ? data : [];
        setAllPatients(patients);
        setPatients(patients);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data from server');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setPatients]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allPatients
      .filter(p => {
        if (filter === 'onboarded') return p.onboardingStep >= 9;
        if (filter === 'in-progress') return p.onboardingStep < 9;
        return true;
      })
      .filter(p => {
        if (!q) return true;
        return (
          p.name?.toLowerCase().includes(q) ||
          p.whatsappNumber?.includes(q) ||
          p.cancerType?.toLowerCase().includes(q) ||
          p.hospitalName?.toLowerCase().includes(q)
        );
      });
  }, [allPatients, search, filter]);

  if (!loading && !serverOnline) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-red-50 p-6 text-red-700">
        <FiAlertCircle className="mr-3 text-2xl" />
        <div>
          <h3 className="font-semibold">Backend Server Not Running</h3>
          <p className="text-sm">Start the backend: cd .. && npm run dev (port 3000)</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        {isAdmin && (
          <Link
            href="/dashboard/patients/new"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <FiUserPlus size={16} /> Add Patient
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm text-gray-600">Total Patients</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{allPatients.length}</div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center text-sm text-gray-600">
            <FiCheckCircle className="mr-2" /> Onboarded
          </div>
          <div className="mt-2 text-3xl font-bold text-green-600">
            {allPatients.filter(p => p.onboardingStep >= 9).length}
          </div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center text-sm text-gray-600">
            <FiClock className="mr-2" /> In Progress
          </div>
          <div className="mt-2 text-3xl font-bold text-yellow-600">
            {allPatients.filter(p => p.onboardingStep < 9).length}
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name, phone, cancer type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'onboarded', 'in-progress'] as FilterMode[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f === 'in-progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Patient list */}
      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Patients</h2>
          {!loading && (
            <span className="text-sm text-gray-500">{filtered.length} of {allPatients.length}</span>
          )}
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {search || filter !== 'all'
              ? 'No patients match your search. Try clearing the filter.'
              : 'No patients yet. Patients will appear here once they message via WhatsApp.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filtered.map(patient => (
              <Link
                key={patient.id}
                href={`/dashboard/patients/${patient.id}`}
                className="block p-6 hover:bg-indigo-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{patient.name || 'Unnamed Patient'}</div>
                    <div className="text-sm text-gray-600">{patient.whatsappNumber}</div>
                    {patient.cancerType && (
                      <div className="mt-1 text-sm text-gray-600">{patient.cancerType}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                      patient.onboardingStep >= 9
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {patient.onboardingStep >= 9 ? 'Onboarded' : `Step ${patient.onboardingStep}/9`}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
