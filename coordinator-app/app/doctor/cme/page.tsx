'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

interface CmeSummary {
  year: number;
  totalHours: number;
  creditCount: number;
  byEventType: Record<string, { count: number; hours: number }>;
  nmcAnnualTarget: number;
  progressPct: number;
}

interface YearData { year: number; hours: number; }

const EVENT_LABELS: Record<string, string> = {
  mdt_participation: 'MDT Meeting',
  case_documentation: 'Case Documentation',
  referral_accepted: 'Referral Review',
  defense_mode_export: 'Medical Record',
};

const CURRENT_YEAR = new Date().getFullYear();

function HBar({ label, value, max, sub }: { label: string; value: number; max: number; sub?: string }) {
  const w = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900">{value.toFixed(2)}h {sub ? `(${sub})` : ''}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

export default function CmePage() {
  const router = useRouter();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [summary, setSummary] = useState<CmeSummary | null>(null);
  const [history, setHistory] = useState<YearData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API_URL}/doctor/cme/summary?year=${year}`, { withCredentials: true }),
      axios.get(`${API_URL}/doctor/cme/history?years=5`, { withCredentials: true }),
    ])
      .then(([sumRes, histRes]) => {
        setSummary(sumRes.data);
        setHistory(histRes.data);
      })
      .catch((err) => {
        if (err?.response?.status === 401) router.replace('/doctor/login');
      })
      .finally(() => setLoading(false));
  }, [year, router]);

  async function handleGenerateCertificate() {
    setGenerating(true);
    try {
      const res = await axios.get(`${API_URL}/doctor/cme/certificate?year=${year}`, {
        withCredentials: true,
        responseType: 'text',
      });
      if (printFrameRef.current) {
        const doc = printFrameRef.current.contentDocument;
        if (doc) { doc.open(); doc.write(res.data); doc.close(); }
        printFrameRef.current.contentWindow?.print();
      }
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  }

  const maxHistHours = Math.max(...history.map((h) => h.hours), 1);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pb-20">
      <div className="px-4 pb-2 pt-6">
        <h1 className="text-xl font-bold text-gray-900">🎓 CME Tracker</h1>
        <p className="mt-1 text-sm text-gray-500">NMC Continuing Professional Development</p>

        {/* Year selector */}
        <div className="mt-3 flex gap-2">
          {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                year === y ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {summary && (
        <div className="space-y-4 px-4 pt-4">

          {/* Progress ring simulation (linear bar) */}
          <section className="rounded-xl bg-indigo-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-indigo-900">{summary.totalHours.toFixed(1)}</p>
                <p className="text-sm text-indigo-700">
                  of {summary.nmcAnnualTarget}h NMC annual target
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-700">{summary.progressPct}%</p>
                <p className="text-xs text-indigo-500">complete</p>
              </div>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-indigo-200">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${summary.progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-indigo-600">
              {summary.creditCount} activities · {(summary.nmcAnnualTarget - summary.totalHours).toFixed(1)}h remaining this year
            </p>
          </section>

          {/* By activity type */}
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              By Activity Type
            </h2>
            {Object.keys(summary.byEventType).length === 0 ? (
              <p className="text-sm text-gray-400">No activities recorded for {year} yet.</p>
            ) : (
              Object.entries(summary.byEventType).map(([type, { count, hours }]) => (
                <HBar
                  key={type}
                  label={EVENT_LABELS[type] ?? type}
                  value={hours}
                  max={summary.totalHours}
                  sub={`${count} session${count !== 1 ? 's' : ''}`}
                />
              ))
            )}
          </section>

          {/* 5-year history */}
          {history.length > 0 && (
            <section className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                5-Year History
              </h2>
              <div className="flex items-end gap-2 h-16">
                {history.map((h) => {
                  const barH = maxHistHours > 0 ? Math.max(4, Math.round((h.hours / maxHistHours) * 56)) : 4;
                  const isTarget = h.hours >= 6;
                  return (
                    <div key={h.year} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-sm ${isTarget ? 'bg-emerald-500' : 'bg-indigo-300'}`}
                        style={{ height: `${barH}px` }}
                        title={`${h.hours.toFixed(1)}h`}
                      />
                      <span className="text-[10px] text-gray-500">{h.year}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-[10px] text-gray-400">Green = met annual target (6h)</p>
            </section>
          )}

          {/* NMC Certificate */}
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-gray-900">🏅 NMC Certificate</h2>
            <p className="mb-3 text-xs text-gray-500">
              Generate a print-ready certificate in NMC-acceptable format for {year}.
            </p>
            <button
              onClick={handleGenerateCertificate}
              disabled={generating || summary.creditCount === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {generating ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Generating…</>
              ) : '📄 Generate Certificate'}
            </button>
            {summary.creditCount === 0 && (
              <p className="mt-2 text-center text-xs text-gray-400">No activities to certify for {year}</p>
            )}
          </section>

        </div>
      )}

      {/* Hidden iframe for print */}
      <iframe
        ref={printFrameRef}
        title="cme-certificate-print"
        className="pointer-events-none fixed -left-full -top-full h-0 w-0 opacity-0"
        aria-hidden="true"
      />
    </div>
  );
}
