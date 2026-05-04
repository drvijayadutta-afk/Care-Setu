'use client';

import { useState } from 'react';
import { FiPlus, FiChevronDown, FiChevronUp, FiTrendingUp } from 'react-icons/fi';
import { createLabResult, getPatientLabResults, LabResult } from '@/lib/api';
import { FLAG_COLORS } from '@/lib/recordRegistry';
import { useFormDraft } from '@/lib/useFormDraft';
import { toast } from '@/lib/toast';
import { Tooltip } from '@/components/Tooltip';
import { TrendChart } from '@/components/TrendChart';

interface LabsTabProps {
  patientId: string;
  labResults: LabResult[];
  onLabsUpdate: (labs: LabResult[]) => void;
}

const EMPTY_FORM = {
  testDate: '', category: 'CBC', testName: '', value: '', unit: '',
  refMin: '', refMax: '', flag: '', notes: '',
};

const LAB_CATEGORIES: { value: string; label: string }[] = [
  { value: 'CBC',           label: 'Complete Blood Count (CBC)' },
  { value: 'LFT',           label: 'Liver Function Tests (LFT)' },
  { value: 'KFT',           label: 'Kidney Function Tests (KFT)' },
  { value: 'TUMOUR_MARKER', label: 'Tumour Markers (CA-125, PSA, CEA…)' },
  { value: 'COAGULATION',   label: 'Coagulation / Clotting Profile' },
  { value: 'URINE',         label: 'Urine Analysis' },
  { value: 'OTHER',         label: 'Other' },
];

const FLAG_LABELS: Record<string, { label: string; hint: string }> = {
  NORMAL:   { label: 'Normal',    hint: 'Within the expected reference range' },
  LOW:      { label: 'Low ↓',     hint: 'Below the lower limit of normal' },
  HIGH:     { label: 'High ↑',    hint: 'Above the upper limit of normal' },
  CRITICAL: { label: '⚠ Critical', hint: 'Significantly outside safe limits — review immediately' },
};

const FLAG_BADGE: Record<string, string> = {
  NORMAL:   'bg-green-100 text-green-800',
  LOW:      'bg-blue-100 text-blue-800',
  HIGH:     'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800 font-semibold',
};

export function LabsTab({ patientId, labResults, onLabsUpdate }: LabsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [trendTestName, setTrendTestName] = useState<string | null>(null);

  // Build a map of testName → sorted entries for trend charting
  const trendableTests = (() => {
    const map: Record<string, LabResult[]> = {};
    for (const l of labResults) {
      if (l.value == null) continue;
      if (!map[l.testName]) map[l.testName] = [];
      map[l.testName].push(l);
    }
    // Only tests with 2+ numeric data points
    return Object.entries(map)
      .filter(([, arr]) => arr.length >= 2)
      .map(([name, arr]) => ({
        name,
        data: [...arr].sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime()),
      }));
  })();

  const { clearDraft } = useFormDraft(`lab-draft-${patientId}`, form, setForm);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.testDate) e.testDate = 'Date is required';
    if (!form.testName.trim()) e.testName = 'Test name is required';
    return e;
  };

  const handleAdd = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const isAbnormal = !!(form.flag && form.flag !== 'NORMAL');
      await createLabResult(patientId, {
        ...form,
        isAbnormal,
        value: form.value ? parseFloat(form.value) : undefined,
        refMin: form.refMin ? parseFloat(form.refMin) : undefined,
        refMax: form.refMax ? parseFloat(form.refMax) : undefined,
      });
      clearDraft();
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast({ type: 'success', message: 'Lab result saved' });
      onLabsUpdate(await getPatientLabResults(patientId));
    } catch {
      toast({ type: 'error', message: 'Could not save — check your connection and try again' });
    } finally {
      setSubmitting(false);
    }
  };

  const inp = (key: keyof typeof EMPTY_FORM) =>
    `w-full rounded border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors[key] ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300'}`;

  const catLabel = (val: string) => LAB_CATEGORIES.find(c => c.value === val)?.label ?? val;

  const selectedTrend = trendableTests.find(t => t.name === trendTestName) ?? null;

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Lab Results</h3>
        <button
          onClick={() => { setShowForm(!showForm); setErrors({}); }}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          <FiPlus size={14} /> Record Lab Result
        </button>
      </div>

      {/* Trend Chart Panel */}
      {trendableTests.length > 0 && (
        <div className="mb-5 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FiTrendingUp size={14} className="text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-800">Lab Value Trends</span>
            <span className="text-xs text-indigo-500">— see how a specific test has changed over time</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {trendableTests.map(t => (
              <button
                key={t.name}
                onClick={() => setTrendTestName(trendTestName === t.name ? null : t.name)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  trendTestName === t.name
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-100'
                }`}
              >
                {t.name} ({t.data.length} readings)
              </button>
            ))}
          </div>

          {selectedTrend && (() => {
            const first = selectedTrend.data[0];
            const refMin = first.refMin ?? undefined;
            const refMax = first.refMax ?? undefined;
            const unit = first.unit ?? '';
            const chartData = selectedTrend.data.map(l => ({
              date: l.testDate,
              value: l.value as number,
            }));
            const latest = selectedTrend.data[selectedTrend.data.length - 1];
            const latestFlag = FLAG_LABELS[latest.flag ?? ''];
            return (
              <div className="bg-white rounded-lg border border-indigo-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">{selectedTrend.name}</span>
                  <div className="flex items-center gap-2">
                    {latestFlag && (
                      <span className={`rounded px-2 py-0.5 text-xs ${FLAG_BADGE[latest.flag ?? ''] ?? 'bg-gray-100'}`}>
                        Latest: {latestFlag.label}
                      </span>
                    )}
                    {refMin != null || refMax != null ? (
                      <span className="text-xs text-gray-400">
                        Ref: {refMin ?? '?'}–{refMax ?? '?'} {unit}
                      </span>
                    ) : null}
                  </div>
                </div>
                <TrendChart
                  data={chartData}
                  refMin={refMin}
                  refMax={refMax}
                  unit={unit}
                  height={120}
                />
              </div>
            );
          })()}
        </div>
      )}

      {showForm && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <p className="text-xs text-indigo-700 font-medium">Enter the lab result details below. Fields marked * are required.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Test Date *</label>
              <input type="date" value={form.testDate}
                onChange={e => setForm({ ...form, testDate: e.target.value })}
                className={inp('testDate')} />
              {errors.testDate && <span className="text-xs text-red-600">{errors.testDate}</span>}
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Category</label>
              <select value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className={inp('category')}>
                {LAB_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Test Name */}
            <div className="flex flex-col gap-1 sm:col-span-3">
              <label className="text-xs font-medium text-gray-700">Test Name *</label>
              <input placeholder="e.g. Haemoglobin, WBC Count, CA 15-3"
                value={form.testName}
                onChange={e => setForm({ ...form, testName: e.target.value })}
                className={inp('testName')} />
              {errors.testName && <span className="text-xs text-red-600">{errors.testName}</span>}
            </div>

            {/* Value + Unit */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Result Value</label>
              <input placeholder="e.g. 8.9" type="number" step="any"
                value={form.value}
                onChange={e => setForm({ ...form, value: e.target.value })}
                className={inp('value')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Unit</label>
              <input placeholder="e.g. g/dL, 10³/µL, U/mL"
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                className={inp('unit')} />
            </div>

            {/* Flag */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Result Status</label>
              <select value={form.flag}
                onChange={e => setForm({ ...form, flag: e.target.value })}
                className={inp('flag')}>
                <option value="">— Select status —</option>
                {Object.entries(FLAG_LABELS).map(([val, { label }]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Reference range */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Normal Range — Min</label>
              <input placeholder="e.g. 4.0" type="number" step="any"
                value={form.refMin}
                onChange={e => setForm({ ...form, refMin: e.target.value })}
                className={inp('refMin')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Normal Range — Max</label>
              <input placeholder="e.g. 10.0" type="number" step="any"
                value={form.refMax}
                onChange={e => setForm({ ...form, refMax: e.target.value })}
                className={inp('refMax')} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-3">
              <label className="text-xs font-medium text-gray-700">Clinical Notes (optional)</label>
              <textarea placeholder="Any additional observations…"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className={inp('notes')} rows={2} />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={submitting}
              className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Lab Result'}
            </button>
            <button onClick={() => { setShowForm(false); setErrors({}); }} disabled={submitting}
              className="flex-1 rounded border border-gray-300 bg-white py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {labResults.map(l => {
          const flagInfo = FLAG_LABELS[l.flag ?? ''];
          const badgeCls = FLAG_BADGE[l.flag ?? ''] ?? 'bg-gray-100 text-gray-700';
          const hasRef = l.refMin != null || l.refMax != null;
          const isExpanded = expandedId === l.id;

          return (
            <div key={l.id}
              className={`rounded border ${l.flag === 'CRITICAL' ? 'border-red-300 bg-red-50' : l.flag === 'HIGH' || l.flag === 'LOW' ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'}`}>
              <button
                className="w-full flex items-center justify-between p-3 text-left"
                onClick={() => setExpandedId(isExpanded ? null : l.id)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{l.testName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{catLabel(l.category)} · {new Date(l.testDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-gray-900">{l.value != null ? `${l.value} ${l.unit ?? ''}`.trim() : '—'}</div>
                    {hasRef && (
                      <div className="text-xs text-gray-400">
                        Ref: {l.refMin ?? '?'}–{l.refMax ?? '?'} {l.unit ?? ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {flagInfo ? (
                    <Tooltip content={flagInfo.hint}>
                      <span className={`rounded px-2 py-0.5 text-xs ${badgeCls}`}>{flagInfo.label}</span>
                    </Tooltip>
                  ) : null}
                  {isExpanded ? <FiChevronUp size={14} className="text-gray-400" /> : <FiChevronDown size={14} className="text-gray-400" />}
                </div>
              </button>

              {isExpanded && l.notes && (
                <div className="px-3 pb-3 pt-0 text-xs text-gray-600 border-t border-gray-100 mt-1">
                  <span className="font-medium">Notes: </span>{l.notes}
                </div>
              )}
            </div>
          );
        })}

        {labResults.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500 text-sm">No lab results recorded yet.</p>
            <p className="text-gray-400 text-xs mt-1">Click <strong>Record Lab Result</strong> above to add the first one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
