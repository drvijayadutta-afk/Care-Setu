'use client';

import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { createPathologyReport, getPatientPathology, PathologyReport } from '@/lib/api';

interface PathologyTabProps {
  patientId: string;
  pathology: PathologyReport[];
  onPathologyUpdate?: (pathology: PathologyReport[]) => void;
}

export function PathologyTab({ patientId, pathology, onPathologyUpdate }: PathologyTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reportDate: '', specimenType: 'Biopsy', site: '', diagnosis: '', grade: '', stage: '', margins: '', notes: '' });

  const handleAdd = async () => {
    if (!form.reportDate || !form.site || !form.diagnosis) return alert('Fill required fields');
    try {
      await createPathologyReport(patientId, { ...form, source: 'manual' });
      setForm({ reportDate: '', specimenType: 'Biopsy', site: '', diagnosis: '', grade: '', stage: '', margins: '', notes: '' });
      setShowForm(false);
      if (onPathologyUpdate) {
        const updated = await getPatientPathology(patientId);
        onPathologyUpdate(updated);
      }
    } catch { alert('Failed to create pathology report'); }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Pathology</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.reportDate} onChange={e => setForm({ ...form, reportDate: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <select value={form.specimenType} onChange={e => setForm({ ...form, specimenType: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
              {['Biopsy', 'Resection', 'Excision', 'FNA'].map(t => <option key={t}>{t}</option>)}
            </select>
            <input placeholder="Site" value={form.site} onChange={e => setForm({ ...form, site: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
            <input placeholder="Diagnosis" value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
            <input placeholder="Grade" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="Stage" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="Margins" value={form.margins} onChange={e => setForm({ ...form, margins: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" rows={2} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white">Create</button>
            <button onClick={() => setShowForm(false)} className="flex-1 rounded bg-gray-300 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {pathology.map(p => (
          <div key={p.id} className="rounded border border-gray-200 p-3">
            <div className="font-semibold text-sm">{p.diagnosis}</div>
            <div className="text-xs text-gray-500">{p.site} • {new Date(p.reportDate).toLocaleDateString()}</div>
            {p.grade && <div className="text-xs text-gray-600 mt-1">Grade: {p.grade}</div>}
          </div>
        ))}
        {pathology.length === 0 && <p className="text-gray-400">No pathology reports yet.</p>}
      </div>
    </div>
  );
}
