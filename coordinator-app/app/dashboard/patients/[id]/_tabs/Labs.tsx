'use client';

import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { createLabResult, getPatientLabResults, LabResult } from '@/lib/api';
import { FLAG_COLORS } from '@/lib/recordRegistry';

interface LabsTabProps {
  patientId: string;
  labResults: LabResult[];
  onLabsUpdate: (labs: LabResult[]) => void;
}

export function LabsTab({ patientId, labResults, onLabsUpdate }: LabsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ testDate: '', category: 'CBC', testName: '', value: '', unit: '', refMin: '', refMax: '', flag: '', notes: '' });

  const handleAdd = async () => {
    if (!form.testDate || !form.testName) return alert('Fill required fields');
    const isAbnormal = !!(form.flag && form.flag !== 'NORMAL');
    try {
      await createLabResult(patientId, {
        ...form,
        isAbnormal,
        value: form.value ? parseFloat(form.value) : undefined,
        refMin: form.refMin ? parseFloat(form.refMin) : undefined,
        refMax: form.refMax ? parseFloat(form.refMax) : undefined
      });
      setForm({ testDate: '', category: 'CBC', testName: '', value: '', unit: '', refMin: '', refMax: '', flag: '', notes: '' });
      setShowForm(false);
      const updated = await getPatientLabResults(patientId);
      onLabsUpdate(updated);
    } catch { alert('Failed to create lab result'); }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Lab Results</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input type="date" value={form.testDate} onChange={e => setForm({ ...form, testDate: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
              {['CBC','LFT','KFT','TUMOUR_MARKER','COAGULATION','URINE','OTHER'].map(c => <option key={c}>{c}</option>)}
            </select>
            <input placeholder="Test Name" value={form.testName} onChange={e => setForm({ ...form, testName: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="Value" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <select value={form.flag} onChange={e => setForm({ ...form, flag: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
              <option value="">Normal/Flag</option>
              {['NORMAL','LOW','HIGH','CRITICAL'].map(f => <option key={f}>{f}</option>)}
            </select>
            <input placeholder="Ref Min" type="number" value={form.refMin} onChange={e => setForm({ ...form, refMin: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-3" />
            <input placeholder="Ref Max" type="number" value={form.refMax} onChange={e => setForm({ ...form, refMax: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-3" />
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-3" rows={2} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white">Create</button>
            <button onClick={() => setShowForm(false)} className="flex-1 rounded bg-gray-300 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {labResults.map(l => (
          <div key={l.id} className="flex items-center justify-between rounded border border-gray-200 p-3 text-sm">
            <div><div className="font-semibold">{l.testName}</div><div className="text-xs text-gray-500">{l.category}</div></div>
            <div className="text-center"><div className="font-semibold">{l.value} {l.unit}</div><div className="text-xs text-gray-400">{new Date(l.testDate).toLocaleDateString()}</div></div>
            {l.flag && <span className={`rounded px-2 py-0.5 text-xs ${FLAG_COLORS[l.flag] ?? 'bg-gray-100'}`}>{l.flag}</span>}
          </div>
        ))}
        {labResults.length === 0 && <p className="text-gray-400">No lab results yet.</p>}
      </div>
    </div>
  );
}
