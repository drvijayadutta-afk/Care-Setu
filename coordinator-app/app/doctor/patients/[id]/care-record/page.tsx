'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

interface GenerationResult {
  recordId: string;
  hash: string;
  rowCount: Record<string, number>;
  generatedAt: string;
  html: string;
}

interface HistoryEntry {
  id: string;
  jsonHash: string;
  rowCount: Record<string, number>;
  emailSentTo?: string;
  generatedAt: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CareRecordPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params?.id as string;

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  // Load history on mount
  useEffect(() => {
    if (!patientId) return;
    axios
      .get(`${API_URL}/doctor/care-record/${patientId}/history`, { withCredentials: true })
      .then((r) => setHistory(r.data))
      .catch((err) => {
        if (err?.response?.status === 401) router.replace('/doctor/login');
      })
      .finally(() => setHistoryLoading(false));
  }, [patientId, router]);

  // When we have HTML, inject into the hidden iframe and trigger print
  useEffect(() => {
    if (!result?.html || !printFrameRef.current) return;
    const frame = printFrameRef.current;
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(result.html);
    doc.close();
  }, [result]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setResult(null);
    try {
      const r = await axios.post(
        `${API_URL}/doctor/care-record/${patientId}/generate`,
        {},
        { withCredentials: true }
      );
      setResult(r.data);
      // Refresh history
      const h = await axios.get(`${API_URL}/doctor/care-record/${patientId}/history`, {
        withCredentials: true,
      });
      setHistory(h.data);
    } catch (err: any) {
      if (err?.response?.status === 401) router.replace('/doctor/login');
      else setError(err?.response?.data?.error ?? 'Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function handlePrint() {
    if (!printFrameRef.current) return;
    printFrameRef.current.contentWindow?.print();
  }

  const totalRows = result
    ? Object.values(result.rowCount).reduce((s, v) => s + v, 0)
    : 0;

  return (
    <div className="mx-auto max-w-md pb-16">

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
          aria-label="Back"
        >
          ‹
        </button>
        <div>
          <p className="text-sm font-semibold text-gray-900">🛡️ Defense Mode</p>
          <p className="text-xs text-gray-500">Complete care record</p>
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4">

        {/* Explainer card */}
        <section className="rounded-xl bg-indigo-50 p-4">
          <h2 className="mb-1 text-sm font-semibold text-indigo-900">What this generates</h2>
          <ul className="space-y-1 text-xs text-indigo-800">
            <li>✓ Complete chronological timeline of this patient's care</li>
            <li>✓ All appointments, check-ins, labs, imaging, pathology</li>
            <li>✓ All clinical notes, alerts, MDT meetings</li>
            <li>✓ Full medication history and outbound communications</li>
            <li>✓ SHA-256 tamper-evidence hash on the last page</li>
            <li>✓ Emailed to your verified address instantly</li>
          </ul>
        </section>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-sm font-semibold text-white shadow-sm disabled:opacity-60 active:bg-indigo-700"
        >
          {generating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Generating… this takes a few seconds
            </>
          ) : (
            '⬇ Generate & Email Care Record'
          )}
        </button>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {/* Success state */}
        {result && (
          <section className="rounded-xl bg-emerald-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-emerald-900">✓ Record generated</h3>
            <div className="mb-3 grid grid-cols-2 gap-1 text-xs text-emerald-800">
              {Object.entries(result.rowCount).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
            <div className="mb-3 rounded bg-white px-2 py-1.5">
              <p className="font-mono text-[10px] text-gray-500 break-all">
                SHA-256: {result.hash}
              </p>
            </div>
            <p className="mb-3 text-xs text-emerald-700">
              {totalRows} records captured · emailed to your verified address
            </p>
            <button
              onClick={handlePrint}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white active:bg-emerald-700"
            >
              🖨️ Open / Print PDF
            </button>
          </section>
        )}

        {/* History */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Generation History
          </h2>
          {historyLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400">No records generated yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div key={entry.id} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">{formatDateTime(entry.generatedAt)}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-gray-400 break-all">
                    {entry.jsonHash.slice(0, 32)}…
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(entry.rowCount as Record<string, number>).map(([k, v]) => (
                      <span key={k} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                        {v} {k}
                      </span>
                    ))}
                  </div>
                  {entry.emailSentTo && (
                    <p className="mt-1 text-[10px] text-gray-500">✉ Sent to {entry.emailSentTo}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Hidden iframe for print-to-PDF */}
      <iframe
        ref={printFrameRef}
        title="care-record-print"
        className="pointer-events-none fixed -left-full -top-full h-0 w-0 opacity-0"
        aria-hidden="true"
      />
    </div>
  );
}
