'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FiActivity, FiAlertCircle, FiCalendar, FiTrendingUp,
  FiDownload, FiRefreshCw, FiArrowLeft, FiUsers, FiFileText,
} from 'react-icons/fi';
import { getOutcomes, OutcomesData } from '@/lib/api';
import { useCoordinatorStore } from '@/lib/store';
import { TrendChart } from '@/components/TrendChart';

const PERIOD_OPTIONS = [
  { value: 7,   label: 'Last 7 days' },
  { value: 30,  label: 'Last 30 days' },
  { value: 90,  label: 'Last 90 days' },
  { value: 180, label: 'Last 180 days' },
];

const SYMPTOM_LABELS: Record<string, string> = {
  fatigue: 'Fatigue', nausea: 'Nausea', vomiting: 'Vomiting', pain: 'Pain',
  fever: 'Fever', diarrhoea: 'Diarrhoea', constipation: 'Constipation',
  appetite_loss: 'Loss of Appetite', weakness: 'Weakness', breathlessness: 'Breathlessness',
  mouth_sores: 'Mouth Sores', hair_loss: 'Hair Loss', skin_rash: 'Skin Rash',
  numbness: 'Numbness / Tingling', swelling: 'Swelling',
};

function symLabel(s: string) {
  return SYMPTOM_LABELS[s.toLowerCase()] ?? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className={`rounded-lg border p-4 bg-white ${accent ?? 'border-gray-200'}`}>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs font-medium text-gray-600 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-xs text-gray-600 truncate flex-shrink-0">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-3">
        <div className={`h-3 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 text-xs text-right text-gray-700 font-semibold">{value}</div>
    </div>
  );
}

function exportCsv(data: OutcomesData) {
  const rows: string[][] = [];
  rows.push(['Metric', 'Value']);
  rows.push(['Period (days)', String(data.periodDays)]);
  rows.push(['Total active patients', String(data.patients.active)]);
  rows.push(['Check-in completion rate', `${data.patients.checkinCompletion}%`]);
  rows.push(['Total check-ins', String(data.checkins.total)]);
  rows.push(['Average wellbeing score', data.checkins.avgScore != null ? data.checkins.avgScore.toFixed(2) : '—']);
  rows.push(['Low-score check-ins (≤2)', String(data.checkins.lowScoreCount)]);
  rows.push(['Total alerts', String(data.alerts.total)]);
  rows.push(['Resolved alerts', String(data.alerts.resolvedCount)]);
  rows.push(['Avg alert resolution (hours)', data.alerts.avgResolutionHours != null ? String(data.alerts.avgResolutionHours) : '—']);
  rows.push(['MDT meetings scheduled', String(data.meetings.total)]);
  rows.push(['MDT meetings completed', String(data.meetings.completed)]);
  rows.push(['Decisions recorded', String(data.meetings.decisionsRecorded)]);
  rows.push(['Sign-off rate (%)', String(data.meetings.signOffRate)]);
  rows.push(['Documents uploaded', String(data.documents.uploaded)]);
  rows.push([]);
  rows.push(['Cancer Type', 'Patients']);
  for (const { type, count } of data.cancerTypeBreakdown) rows.push([type, String(count)]);
  rows.push([]);
  rows.push(['Protocol', 'Patients']);
  for (const { protocol, count } of data.protocolBreakdown) rows.push([protocol, String(count)]);
  rows.push([]);
  rows.push(['Top Symptoms', 'Reports']);
  for (const { symptom, count } of data.checkins.topSymptoms) rows.push([symLabel(symptom), String(count)]);

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `care-setu-outcomes-${data.periodDays}d.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OutcomesPage() {
  const router = useRouter();
  const { coordinatorRole } = useCoordinatorStore();
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<OutcomesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getOutcomes(period));
    } catch {
      setError('Could not load outcomes data — please try again');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (coordinatorRole && coordinatorRole !== 'ADMIN') router.push('/dashboard');
  }, [coordinatorRole, router]);

  useEffect(() => { load(); }, [load]);

  if (coordinatorRole && coordinatorRole !== 'ADMIN') return null;

  const maxType = data ? Math.max(...data.cancerTypeBreakdown.map(t => t.count), 1) : 1;
  const maxProtocol = data ? Math.max(...data.protocolBreakdown.map(p => p.count), 1) : 1;
  const maxSym = data ? Math.max(...data.checkins.topSymptoms.map(s => s.count), 1) : 1;
  const totalAlerts = data ? data.alerts.total : 0;

  const alertColors: Record<string, string> = {
    CRITICAL: 'bg-red-500', HIGH: 'bg-orange-400', MEDIUM: 'bg-yellow-400', LOW: 'bg-blue-400',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="text-gray-400 hover:text-indigo-600">
            <FiArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hospital Outcome Dashboard</h1>
            <p className="text-sm text-gray-500">Aggregate clinical metrics across all active patients — for NABH reporting and protocol review.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={e => setPeriod(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {PERIOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">
            <FiRefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {data && (
            <button onClick={() => exportCsv(data)}
              className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">
              <FiDownload size={12} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading && !data && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading outcomes data…</div>
      )}

      {data && (
        <>
          {/* ── Patient cohort overview ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FiUsers size={14} className="text-indigo-600" />
              <h2 className="font-semibold text-gray-800">Patient Cohort</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Active patients" value={data.patients.active} />
              <StatCard label="Total patients" value={data.patients.total} />
              <StatCard
                label="Check-in completion"
                value={`${data.patients.checkinCompletion}%`}
                sub={`of active patients checked in during this period`}
                accent={data.patients.checkinCompletion >= 70 ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}
              />
              <StatCard label="Total check-ins" value={data.checkins.total} sub={`in last ${data.periodDays} days`} />
            </div>
          </section>

          {/* ── Wellbeing trend ── */}
          {data.checkins.scoreByDay.length >= 2 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <FiTrendingUp size={14} className="text-indigo-600" />
                <h2 className="font-semibold text-gray-800">Average Wellbeing Score — Daily Trend</h2>
                <span className="text-xs text-gray-400">(1 = very unwell · 5 = feeling good · green band = target ≥3)</span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-4 mb-3">
                  {data.checkins.avgScore != null && (
                    <div>
                      <span className="text-2xl font-bold text-gray-900">{data.checkins.avgScore.toFixed(1)}</span>
                      <span className="text-sm text-gray-500">/5 avg across all check-ins</span>
                    </div>
                  )}
                  <div className={`rounded-full px-3 py-1 text-xs font-medium ${data.checkins.lowScoreCount > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                    {data.checkins.lowScoreCount} distress reports (score ≤2)
                  </div>
                </div>
                <TrendChart
                  data={data.checkins.scoreByDay.map(d => ({ date: d.date, value: d.avg }))}
                  refMin={3}
                  refMax={5}
                  unit="/5"
                  height={130}
                />
              </div>
            </section>
          )}

          {/* ── Symptom burden + Alerts side by side ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Symptom burden */}
            {data.checkins.topSymptoms.length > 0 && (
              <section className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FiActivity size={14} className="text-orange-500" />
                  <h2 className="font-semibold text-gray-800 text-sm">Top Reported Symptoms</h2>
                </div>
                <div className="space-y-2">
                  {data.checkins.topSymptoms.map(({ symptom, count }) => (
                    <HBar key={symptom} label={symLabel(symptom)} value={count} max={maxSym} color="bg-orange-400" />
                  ))}
                </div>
              </section>
            )}

            {/* Alerts */}
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <FiAlertCircle size={14} className="text-red-500" />
                <h2 className="font-semibold text-gray-800 text-sm">Alert Summary</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <StatCard label="Total alerts" value={data.alerts.total} />
                <StatCard label="Resolved" value={`${data.alerts.resolvedCount}/${data.alerts.total}`} />
                {data.alerts.avgResolutionHours != null && (
                  <div className="col-span-2">
                    <StatCard
                      label="Avg time to resolve"
                      value={`${data.alerts.avgResolutionHours}h`}
                      sub="from alert creation to resolution"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {Object.entries(data.alerts.bySeverity).map(([sev, count]) => (
                  <HBar key={sev} label={sev} value={count} max={totalAlerts} color={alertColors[sev] ?? 'bg-gray-400'} />
                ))}
              </div>
            </section>
          </div>

          {/* ── MDT Activity ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FiCalendar size={14} className="text-indigo-600" />
              <h2 className="font-semibold text-gray-800">MDT / Tumor Board Activity</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Meetings scheduled" value={data.meetings.total} />
              <StatCard label="Meetings completed" value={data.meetings.completed} />
              <StatCard label="Decisions recorded" value={data.meetings.decisionsRecorded} />
              <StatCard
                label="Sign-off rate"
                value={`${data.meetings.signOffRate}%`}
                sub="of participants who signed off on decisions"
                accent={data.meetings.signOffRate >= 80 ? 'border-green-300 bg-green-50' : 'border-gray-200'}
              />
            </div>
          </section>

          {/* ── Cancer type + Protocol breakdown ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.cancerTypeBreakdown.length > 0 && (
              <section className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FiFileText size={14} className="text-purple-500" />
                  <h2 className="font-semibold text-gray-800 text-sm">Cancer Type Breakdown</h2>
                </div>
                <div className="space-y-2">
                  {data.cancerTypeBreakdown.map(({ type, count }) => (
                    <HBar key={type} label={type} value={count} max={maxType} color="bg-purple-400" />
                  ))}
                </div>
              </section>
            )}

            {data.protocolBreakdown.length > 0 && (
              <section className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FiActivity size={14} className="text-teal-500" />
                  <h2 className="font-semibold text-gray-800 text-sm">Protocol Distribution</h2>
                </div>
                <div className="space-y-2">
                  {data.protocolBreakdown.map(({ protocol, count }) => (
                    <HBar key={protocol} label={protocol} value={count} max={maxProtocol} color="bg-teal-400" />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Operational stats ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FiFileText size={14} className="text-gray-500" />
              <h2 className="font-semibold text-gray-800">Operational Stats</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Documents uploaded" value={data.documents.uploaded} sub="in this period" />
              <StatCard label="Medication log entries" value={data.medications.logEntries} sub="taken/skip confirmations" />
            </div>
          </section>

          <p className="text-xs text-gray-400 pb-4">
            Data covers the last {data.periodDays} days across all active patients. Use Export CSV for NABH/JCI accreditation reports.
          </p>
        </>
      )}
    </div>
  );
}
