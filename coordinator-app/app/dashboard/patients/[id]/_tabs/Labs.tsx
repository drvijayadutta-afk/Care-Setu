'use client';

import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { createLabResult, getPatientLabResults, LabResult } from '@/lib/api';
import { FLAG_COLORS } from '@/lib/recordRegistry';
import { useFormDraft } from '@/lib/useFormDraft';
import { toast } from '@/lib/toast';

interface LabsTabProps {
  patientId: string;
  labResults: LabResult[];
  onLabsUpdate: (labs: LabResult[]) => void;
}

const EMPTY_FORM = { testDate: '', category: 'CBC', testName: '', value: '', unit: '', refMin: '', refMax: '', flag: '', notes: '' };

export function LabsTab({ patientId, labResults, onLabsUpdate }: LabsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { clearDraft } = useFormDraft(`lab-draft-${patientId}`, form, setForm);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.testDate) e.testDate = 'Required';
    if (!form.testName.trim()) e.testName = 'Required';
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
      const updated = await getPatientLabResults(patientId);
      onLabsUpdate(updated);
    } catch {
      toast({ type: 'error', message: 'Failed to save lab result — check your connection and try again' });
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key: keyof typeof EMPTY_FORM) =>
    errors[key] ? 'rounded border border-red-400 px-2 py-1.5 text-sm ring-1 ring-red-400' : 'rounded border px-2 py-1.5 text-sm';

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Lab Results</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          <FiPlus /> Add
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-0.5">
              <input type="date" value={form.testDate} onChange={e => setForm({ ...form, testDate: e.target.value })} className={field('testDate')} />
              {errors.testDate && <span className="text-xs text-red-600">{errors.testDate}</span>}
            </div>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={field('category')}>
              {['CBC', 'LFT', 'KFT', 'TUMOUR_MARKER', 'COAGULATION', 'URINE', 'OTHER'].map(c => <option key={c}>{c}</option>)}
            </select>
            <div className="flex flex-col gap-0.5">
              <input placeholder="Test Name *" value={form.testName} onChange={e => setForm({ ...form, testName: e.target.value })} className={field('testName')} />
              {errors.testName && <span className="text-xs text-red-600">{errors.testName}</span>}
            </div>
            <input placeholder="Value" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className={field('value')} />
            <input placeholder="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={field('unit')} />
            <select value={form.flag} onChange={e => setForm({ ...form, flag: e.target.value })} className={field('flag')}>
              <option value="">Normal / Flag</option>
              {['NORMAL', 'LOW', 'HIGH', 'CRITICAL'].map(f => <option key={f}>{f}</option>)}
            </select>
            <input placeholder="Ref Min" type="number" value={form.refMin} onChange={e => setForm({ ...form, refMin: e.target.value })} className={`${field('refMin')} col-span-3`} />
            <input placeholder="Ref Max" type="number" value={form.refMax} onChange={e => setForm({ ...form, refMax: e.target.value })} className={`${field('refMax')} col-span-3`} />
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={`${field('notes')} col-span-3`} rows={2} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={submitting}
              className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setErrors({}); }}
              disabled={submitting}
              className="flex-1 rounded bg-gray-300 py-2 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {labResults.map(l => (
          <div key={l.id} className="flex items-center justify-between rounded border border-gray-200 p-3 text-sm">
            <div>
              <div className="font-semibold">{l.testName}</div>
              <div className="text-xs text-gray-500">{l.category}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{l.value} {l.unit}</div>
              <div className="text-xs text-gray-400">{new Date(l.testDate).toLocaleDateString()}</div>
            </div>
            {l.flag && <span className={`rounded px-2 py-0.5 text-xs ${FLAG_COLORS[l.flag] ?? 'bg-gray-100'}`}>{l.flag}</span>}
          </div>
        ))}
        {labResults.length === 0 && (
          <p className="text-center text-gray-400 py-8">No lab results yet. Click <strong>Add</strong> to record one.</p>
        )}
      </div>
    </div>
  );
}
