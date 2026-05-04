'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

type Period = 30 | 90 | 180;

interface OutcomeData {
  period: { days: number; since: string };
  cohort: {
    totalPatients: number;
    activePatients: number;
    byStage: Record<string, number>;
    byProtocol: Record<string, number>;
  };
  wellbeing: {
    averageCheckinScore: number | null;
    lowScoreCount: number;
    totalCheckins: number;
    scoreDistribution: Record<string, number>;
    topSymptoms: Array<{ symptom: string; count: number }>;
  };
  alerts: {
    total: number;
    bySeverity: Record<string, number>;
    resolutionRate: number | null;
  };
  mdt: {
    meetingsAttended: number;
    signedOffCount: number;
    consensusReachedRate: number | null;
  };
  labsAbnormal: {
    criticalCount: number;
    highLowCount: number;
    totalInPeriod: number;
  };
  imagingResponses: {
    cr: number; pr: number; sd: number; pd: number; unknown: number;
  };
}

interface PeerData {
  metric: string;
  yourValue: number;
  percentile: number;
  peerMedian: number;
  peerCount: number;
  sufficientData: boolean;
}

function pct(val: number | null): string {
  if (val == null) return '—';
  return `${Math.round(val * 100)}%`;
}

function num(val: number | null, decimals = 1): string {
  if (val == null) return '—';
  return val.toFixed(decimals);
}

function Bar({ value, max, colour }: { value: number; max: number; colour: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${colour}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function PeerBenchmarkBar({ data }: { data: PeerData }) {
  if (!data.sufficientData) {
    return (
      <p className="text-xs text-gray-400 italic">
        Peer comparison unavailable (fewer than 10 peers in network)
      </p>
    );
  }
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-500">
        <span>You: <strong className="text-gray-800">{num(data.yourValue, 2)}</strong></span>
        <span>Peers median: {num(data.peerMedian, 2)}</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="absolute h-full rounded-full bg-indigo-500"
          style={{ width: `${data.percentile}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-400"
          style={{ left: '50%' }}
          title="Median"
        />
      </div>
      <p className="mt-1 text-right text-xs text-indigo-700 font-semibold">
        Top {100 - data.percentile}% of {data.peerCount} peers
      </p>
    </div>
  );
}

const RESPONSE_COLOURS: Record<string, string> = {
  cr: 'bg-emerald-500',
  pr: 'bg-teal-400',
  sd: 'bg-amber-400',
  pd: 'bg-red-400',
  unknown: 'bg-gray-300',
};

export default function MyOutcomesPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>(90);
  const [data, setData] = useState<OutcomeData | null>(null);
  const [benchmark, setBenchmark] = useState<PeerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API_URL}/doctor/my-outcomes?days=${period}`, { withCredentials: true }),
      axios.get(`${API_URL}/doctor/peer-benchmark?metric=avg_checkin_score&days=${period}`, {
        withCredentials: true,
      }),
    ])
      .then(([outRes, bmRes]) => {
        setData(outRes.data);
        setBenchmark(bmRes.data);
      })
      .catch((err) => {
        if (err?.response?.status === 401) router.replace('/doctor/login');
      })
      .finally(() => setLoading(false));
  }, [period, router]);

  const PERIODS: Period[] = [30, 90, 180];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (!data) return null;

  const imgTotal =
    data.imagingResponses.cr + data.imagingResponses.pr +
    data.imagingResponses.sd + data.imagingResponses.pd + data.imagingResponses.unknown;

  const topProtocol = Object.entries(data.cohort.byProtocol).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="mx-auto max-w-md pb-20">

      {/* Header */}
      <div className="px-4 pb-2 pt-6">
        <h1 className="text-xl font-bold text-gray-900">📊 My Outcomes</h1>
        <p className="mt-1 text-sm text-gray-500">Your patient cohort performance</p>

        {/* Period selector */}
        <div className="mt-3 flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                period === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4">

        {/* Cohort overview */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Cohort</h2>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Total patients" value={String(data.cohort.totalPatients)} />
            <MetricCard label="Active patients" value={String(data.cohort.activePatients)} />
          </div>
          {topProtocol && (
            <p className="mt-2 text-xs text-gray-500">
              Top protocol: <strong>{topProtocol[0]}</strong> ({topProtocol[1]} patients)
            </p>
          )}
          {Object.keys(data.cohort.byProtocol).length > 1 && (
            <div className="mt-3 space-y-1.5">
              {Object.entries(data.cohort.byProtocol)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([proto, count]) => (
                  <div key={proto}>
                    <div className="mb-0.5 flex justify-between text-xs text-gray-600">
                      <span className="truncate">{proto}</span>
                      <span className="ml-2 font-medium">{count}</span>
                    </div>
                    <Bar value={count} max={data.cohort.totalPatients} colour="bg-indigo-400" />
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Wellbeing */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Patient Wellbeing
          </h2>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-gray-900">
                {data.wellbeing.averageCheckinScore != null
                  ? data.wellbeing.averageCheckinScore.toFixed(1)
                  : '—'}
              </p>
              <p className="text-[10px] text-gray-500">Avg score /5</p>
            </div>
            <div>
              <p className="text-xl font-bold text-red-600">{data.wellbeing.lowScoreCount}</p>
              <p className="text-[10px] text-gray-500">Low scores (≤2)</p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{data.wellbeing.totalCheckins}</p>
              <p className="text-[10px] text-gray-500">Check-ins</p>
            </div>
          </div>

          {/* Score distribution */}
          <div className="flex gap-1">
            {['1','2','3','4','5'].map((s) => {
              const count = data.wellbeing.scoreDistribution[s] ?? 0;
              const max = Math.max(...Object.values(data.wellbeing.scoreDistribution));
              const h = max > 0 ? Math.max(4, Math.round((count / max) * 48)) : 4;
              const colour = Number(s) <= 2 ? 'bg-red-400' : Number(s) === 3 ? 'bg-amber-400' : 'bg-emerald-400';
              return (
                <div key={s} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-12 items-end">
                    <div className={`w-full rounded-sm ${colour}`} style={{ height: `${h}px` }} />
                  </div>
                  <span className="text-[10px] text-gray-500">{s}</span>
                </div>
              );
            })}
          </div>

          {/* Peer benchmark */}
          {benchmark && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Peer comparison — avg score
              </p>
              <PeerBenchmarkBar data={benchmark} />
            </div>
          )}
        </section>

        {/* Top symptoms */}
        {data.wellbeing.topSymptoms.length > 0 && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Top Reported Symptoms
            </h2>
            <div className="space-y-2">
              {data.wellbeing.topSymptoms.slice(0, 6).map(({ symptom, count }) => (
                <div key={symptom}>
                  <div className="mb-0.5 flex justify-between text-xs">
                    <span className="capitalize text-gray-700">{symptom}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <Bar
                    value={count}
                    max={data.wellbeing.topSymptoms[0].count}
                    colour="bg-amber-400"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Alerts */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Alerts
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{data.alerts.total}</p>
              <p className="text-[10px] text-gray-500">Total alerts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{pct(data.alerts.resolutionRate)}</p>
              <p className="text-[10px] text-gray-500">Resolution rate</p>
            </div>
          </div>
          {Object.entries(data.alerts.bySeverity).length > 0 && (
            <div className="mt-3 flex gap-2">
              {Object.entries(data.alerts.bySeverity).map(([sev, count]) => (
                <div
                  key={sev}
                  className={`flex-1 rounded-lg p-2 text-center text-xs ${
                    sev === 'critical' ? 'bg-red-50' :
                    sev === 'high' ? 'bg-orange-50' : 'bg-amber-50'
                  }`}
                >
                  <p className="font-bold text-gray-800">{count}</p>
                  <p className="text-gray-500 capitalize">{sev}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* MDT */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            MDT Activity
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-gray-900">{data.mdt.meetingsAttended}</p>
              <p className="text-[10px] text-gray-500">Meetings</p>
            </div>
            <div>
              <p className="text-xl font-bold text-indigo-700">{data.mdt.signedOffCount}</p>
              <p className="text-[10px] text-gray-500">Signed off</p>
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-700">
                {pct(data.mdt.consensusReachedRate)}
              </p>
              <p className="text-[10px] text-gray-500">Consensus</p>
            </div>
          </div>
        </section>

        {/* Labs */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Abnormal Labs
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-red-600">{data.labsAbnormal.criticalCount}</p>
              <p className="text-[10px] text-gray-500">Critical</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-600">{data.labsAbnormal.highLowCount}</p>
              <p className="text-[10px] text-gray-500">High / Low</p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-700">{data.labsAbnormal.totalInPeriod}</p>
              <p className="text-[10px] text-gray-500">Total flagged</p>
            </div>
          </div>
        </section>

        {/* Imaging responses */}
        {imgTotal > 0 && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Imaging Response (RECIST)
            </h2>
            <div className="flex h-4 overflow-hidden rounded-full">
              {(['cr', 'pr', 'sd', 'pd', 'unknown'] as const).map((key) => {
                const count = data.imagingResponses[key];
                if (!count) return null;
                return (
                  <div
                    key={key}
                    className={RESPONSE_COLOURS[key]}
                    style={{ width: `${(count / imgTotal) * 100}%` }}
                    title={`${key.toUpperCase()}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
              {(['cr', 'pr', 'sd', 'pd'] as const).map((key) => (
                <div key={key} className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${RESPONSE_COLOURS[key]}`} />
                  <span className="uppercase text-gray-600">{key}</span>
                  <span className="font-semibold">{data.imagingResponses[key]}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-emerald-700 font-medium">
              Response rate (CR+PR): {imgTotal > 0 ? pct((data.imagingResponses.cr + data.imagingResponses.pr) / imgTotal) : '—'}
            </p>
          </section>
        )}

        {data.cohort.totalPatients < 5 && (
          <p className="text-center text-xs text-gray-400 italic">
            More data needed for meaningful insights (fewer than 5 patients)
          </p>
        )}
      </div>
    </div>
  );
}
