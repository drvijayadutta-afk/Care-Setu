'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

interface ExportHistory {
  id: string;
  cohortDef: Record<string, string>;
  rowCount: number;
  exportedAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function CohortsPage() {
  const router = useRouter();
  const [cancerType, setCancerType] = useState('');
  const [stage, setStage] = useState('');
  const [protocol, setProtocol] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<ExportHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_URL}/doctor/cohorts/exports`, { withCredentials: true })
      .then((r) => setHistory(r.data))
      .catch((err) => {
        if (err?.response?.status === 401) router.replace('/doctor/login');
      })
      .finally(() => setHistoryLoading(false));
  }, [router]);

  async function handleExport() {
    setError('');
    setExporting(true);
    try {
      const res = await axios.post(
        `${API_URL}/doctor/cohorts/export`,
        { cancerType: cancerType || undefined, stage: stage || undefined, protocol: protocol || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
        { withCredentials: true, responseType: 'blob' }
      );

      // Trigger CSV download
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cohort-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      // Refresh history
      const h = await axios.get(`${API_URL}/doctor/cohorts/exports`, { withCredentials: true });
      setHistory(h.data);
    } catch (err: any) {
      if (err?.response?.status === 400) {
        // Parse blob to get error JSON
        const text = await err.response.data.text?.() ?? '';
        try {
          const errData = JSON.parse(text);
          setError(errData.error ?? 'Export failed.');
        } catch {
          setError('Cohort too small for de-identified export (minimum 5 patients).');
        }
      } else if (err?.response?.status === 401) {
        router.replace('/doctor/login');
      } else {
        setError('Export failed. Please try again.');
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md pb-20">
      <div className="px-4 pb-2 pt-6">
        <h1 className="text-xl font-bold text-gray-900">🔬 Publication Cohort</h1>
        <p className="mt-1 text-sm text-gray-500">De-identified CSV for research use</p>
      </div>

      <div className="space-y-4 px-4 pt-4">

        {/* Privacy notice */}
        <section className="rounded-xl bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            🔒 <strong>Privacy:</strong> Exports contain no direct identifiers. Age is replaced with age bands.
            Minimum 5 patients required (k-anonymity). Every export is logged in the audit trail.
          </p>
        </section>

        {/* Filter form */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Define Cohort
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600">Cancer Type</label>
              <input
                type="text"
                placeholder="e.g. Breast, Lung"
                value={cancerType}
                onChange={(e) => setCancerType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Stage (optional)</label>
              <input
                type="text"
                placeholder="e.g. IIIA, IV"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Treatment Protocol (optional)</label>
              <input
                type="text"
                placeholder="e.g. AC-T, FOLFOX"
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-600">Diagnosed from</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {exporting ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Generating CSV…</>
          ) : '⬇ Export De-identified CSV'}
        </button>

        <div className="text-center text-xs text-gray-400">
          Data includes: age band, gender, diagnosis, protocol, cycles, labs, RECIST response
        </div>

        {/* Export history */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Export History
          </h2>
          {historyLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400">No exports yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map((e) => (
                <div key={e.id} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">{e.rowCount} patients</span>
                    <span className="text-xs text-gray-400">{formatDate(e.exportedAt)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(e.cohortDef).filter(([, v]) => v).map(([k, v]) => (
                      <span key={k} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
