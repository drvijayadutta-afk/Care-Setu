'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiShield, FiAlertTriangle, FiSearch, FiDownload, FiArrowLeft } from 'react-icons/fi';
import { getAuditLog, getAuditSummary } from '@/lib/api';
import { useCoordinatorStore } from '@/lib/store';

interface AuditEntry {
  id: string;
  coordinatorId: string;
  patientId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  isOutOfScope: boolean;
  isCrossHospital: boolean;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  coordinator?: { name: string };
  patient?: { name: string };
}

interface AuditSummary {
  totalAccesses30d: number;
  outOfScopeCount: number;
  crossHospitalCount: number;
  flaggedCoordinators: { coordinatorId: string; name: string; count: number }[];
  topViewedPatients: { patientId: string; name: string; count: number }[];
}

export default function CompliancePage() {
  const router = useRouter();
  const { coordinatorRole } = useCoordinatorStore();

  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [outOfScopeOnly, setOutOfScopeOnly] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [coordSearch, setCoordSearch] = useState('');

  // Redirect non-admins
  useEffect(() => {
    const role = coordinatorRole || localStorage.getItem('coordinator_role');
    if (role && role !== 'ADMIN') router.push('/dashboard');
  }, [coordinatorRole, router]);

  // Load summary on mount
  useEffect(() => {
    getAuditSummary()
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await getAuditLog({
        outOfScopeOnly,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: 100,
      });
      setLogs(data as AuditEntry[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  }, [outOfScopeOnly, fromDate, toDate]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const filteredLogs = logs.filter(l => {
    if (!coordSearch) return true;
    const q = coordSearch.toLowerCase();
    return (
      (l.coordinator?.name ?? l.coordinatorId).toLowerCase().includes(q) ||
      (l.patient?.name ?? l.patientId).toLowerCase().includes(q)
    );
  });

  const exportCsv = () => {
    const header = 'Timestamp,Coordinator,Patient,Action,Resource,Scope,Cross-Hospital,IP';
    const rows = filteredLogs.map(l =>
      [
        l.createdAt,
        l.coordinator?.name ?? l.coordinatorId,
        l.patient?.name ?? l.patientId,
        l.action,
        [l.resourceType, l.resourceId].filter(Boolean).join(':'),
        l.isOutOfScope ? 'Out-of-Scope' : 'In-Scope',
        l.isCrossHospital ? 'Yes' : 'No',
        l.ipAddress ?? '',
      ].map(v => `"${v}"`).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6 text-gray-400">Loading compliance data…</div>;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin" className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <FiArrowLeft size={14} /> Admin
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FiShield className="text-indigo-600" /> Compliance &amp; Audit Log
        </h1>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Total accesses (30d)</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{summary.totalAccesses30d}</div>
          </div>
          <div className={`rounded-xl border p-5 ${summary.outOfScopeCount > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Out-of-scope</div>
            <div className={`mt-2 text-3xl font-bold ${summary.outOfScopeCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>
              {summary.outOfScopeCount}
            </div>
          </div>
          <div className={`rounded-xl border p-5 ${summary.crossHospitalCount > 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'}`}>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Cross-hospital</div>
            <div className={`mt-2 text-3xl font-bold ${summary.crossHospitalCount > 0 ? 'text-orange-700' : 'text-gray-900'}`}>
              {summary.crossHospitalCount}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Flagged coordinators</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{summary.flaggedCoordinators.length}</div>
          </div>
        </div>
      )}

      {/* Flagged coordinators */}
      {summary && summary.flaggedCoordinators.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-white p-5">
          <h3 className="mb-3 font-semibold text-red-700 flex items-center gap-2">
            <FiAlertTriangle size={16} /> Coordinators with Out-of-Scope Accesses (30d)
          </h3>
          <div className="space-y-2">
            {summary.flaggedCoordinators.map(c => (
              <div key={c.coordinatorId} className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-2.5 text-sm">
                <span className="font-medium text-gray-800">{c.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-red-700 font-semibold">{c.count} out-of-scope access{c.count !== 1 ? 'es' : ''}</span>
                  <button
                    onClick={() => { setCoordSearch(c.name); setOutOfScopeOnly(true); }}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    View logs
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters for audit log table */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            value={coordSearch} onChange={e => setCoordSearch(e.target.value)}
            placeholder="Filter by coordinator or patient name…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={outOfScopeOnly}
            onChange={e => setOutOfScopeOnly(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600"
          />
          Out-of-scope only
        </label>
        <input
          type="date"
          value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={toDate} onChange={e => setToDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="To"
        />
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <FiDownload size={14} /> Export CSV
        </button>
      </div>

      {/* Audit log table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Audit Log</span>
          <span className="text-xs text-gray-400">{filteredLogs.length} records</span>
        </div>
        {logsLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No records match your filters</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">Timestamp</th>
                  <th className="px-5 py-3 text-left">Coordinator</th>
                  <th className="px-5 py-3 text-left">Patient</th>
                  <th className="px-5 py-3 text-left">Action</th>
                  <th className="px-5 py-3 text-left">Scope</th>
                  <th className="px-5 py-3 text-left">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map(l => (
                  <tr key={l.id} className={l.isOutOfScope ? 'bg-red-50' : l.isCrossHospital ? 'bg-orange-50' : ''}>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmt(l.createdAt)}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{l.coordinator?.name ?? l.coordinatorId.slice(0, 8)}</td>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/patients/${l.patientId}`} className="text-indigo-600 hover:underline">
                        {l.patient?.name ?? l.patientId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{l.action.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3">
                      {l.isOutOfScope ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Out-of-Scope</span>
                      ) : l.isCrossHospital ? (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">Cross-Hospital</span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">In-Scope</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{l.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
