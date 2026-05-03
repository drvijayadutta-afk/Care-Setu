'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { getPatients, getActivityFeed, Patient, ActivityItem, healthCheck } from '@/lib/api';
import { useCoordinatorStore } from '@/lib/store';
import { useGlobalWebSocket, GlobalWSEvent } from '@/lib/useGlobalWebSocket';
import Link from 'next/link';
import {
  FiAlertCircle, FiCheckCircle, FiClock, FiSearch, FiUserPlus,
  FiActivity, FiMessageCircle, FiUpload, FiGitBranch, FiCalendar,
  FiAlertTriangle, FiChevronRight,
} from 'react-icons/fi';

type FilterMode = 'all' | 'onboarded' | 'in-progress';

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  checkin:          <FiCheckCircle size={13} className="text-green-500" />,
  alert:            <FiAlertTriangle size={13} className="text-red-500" />,
  document_uploaded:<FiUpload size={13} className="text-blue-500" />,
  outbound_message: <FiMessageCircle size={13} className="text-indigo-500" />,
  referral:         <FiGitBranch size={13} className="text-purple-500" />,
  appointment:      <FiCalendar size={13} className="text-yellow-600" />,
};

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH:     'bg-orange-500 text-white',
  MEDIUM:   'bg-yellow-400 text-gray-900',
  LOW:      'bg-blue-400 text-white',
};

export default function DashboardPage() {
  const { setPatients, coordinatorRole } = useCoordinatorStore();
  const isAdmin = coordinatorRole === 'ADMIN';
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  // Live data
  const [alertBadges, setAlertBadges] = useState<Record<string, { severity: string; count: number }>>({});
  const [liveFeed, setLiveFeed] = useState<ActivityItem[]>([]);
  const [feedOpen, setFeedOpen] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const online = await healthCheck();
        setServerOnline(online);
        if (!online) { setLoading(false); return; }
        const [data, feed] = await Promise.all([getPatients(), getActivityFeed(30)]);
        const patients = Array.isArray(data) ? data : [];
        setAllPatients(patients);
        setPatients(patients);
        setLiveFeed(feed);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [setPatients]);

  const handleGlobalEvent = useCallback((event: GlobalWSEvent) => {
    if (event.type === 'alert_badge') {
      setAlertBadges(prev => {
        const existing = prev[event.patientId];
        return {
          ...prev,
          [event.patientId]: {
            severity: event.severity,
            count: (existing?.count ?? 0) + 1,
          },
        };
      });
    } else if (event.type === 'activity') {
      const item: ActivityItem = {
        id: `${event.patientId}-${event.timestamp}`,
        type: event.eventKind,
        patientId: event.patientId,
        patientName: event.patientName,
        summary: event.summary,
        severity: event.severity,
        createdAt: event.timestamp,
      };
      setLiveFeed(prev => [item, ...prev].slice(0, 50));
    }
  }, []);

  useGlobalWebSocket(handleGlobalEvent);

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

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

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
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFeedOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <FiActivity size={14} /> Live Feed
            </button>
            {isAdmin && (
              <Link
                href="/dashboard/patients/new"
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <FiUserPlus size={16} /> Add Patient
              </Link>
            )}
          </div>
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
              {filtered.map(patient => {
                const badge = alertBadges[patient.id];
                return (
                  <Link
                    key={patient.id}
                    href={`/dashboard/patients/${patient.id}`}
                    className="block p-6 hover:bg-indigo-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {badge && (
                          <span className={`mt-1 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${SEVERITY_BADGE[badge.severity] ?? 'bg-red-500 text-white'}`}>
                            {badge.severity}
                          </span>
                        )}
                        <div>
                          <div className="font-semibold text-gray-900">{patient.name || 'Unnamed Patient'}</div>
                          <div className="text-sm text-gray-600">{patient.whatsappNumber}</div>
                          {patient.cancerType && (
                            <div className="mt-1 text-sm text-gray-600">{patient.cancerType}</div>
                          )}
                        </div>
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
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Live Activity Feed panel */}
      {feedOpen && (
        <aside className="w-80 flex-shrink-0">
          <div className="sticky top-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <FiActivity size={14} className="text-indigo-500" />
                Live Activity
              </div>
              <span className="text-xs text-gray-400">{liveFeed.length} events</span>
            </div>
            {liveFeed.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No recent activity</div>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-50">
                {liveFeed.map((item, i) => (
                  <Link
                    key={`${item.id}-${i}`}
                    href={`/dashboard/patients/${item.patientId}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className="mt-0.5 flex-shrink-0">
                      {ACTIVITY_ICONS[item.type] ?? <FiActivity size={13} className="text-gray-400" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{item.patientName}</div>
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.summary}</div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs text-gray-400 whitespace-nowrap">{fmtTime(item.createdAt)}</span>
                      {item.severity && (
                        <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${SEVERITY_BADGE[item.severity] ?? ''}`}>
                          {item.severity}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="border-t border-gray-100 px-4 py-2">
              <Link href="/dashboard" className="flex items-center justify-center gap-1 text-xs text-indigo-600 hover:underline">
                View all <FiChevronRight size={11} />
              </Link>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
