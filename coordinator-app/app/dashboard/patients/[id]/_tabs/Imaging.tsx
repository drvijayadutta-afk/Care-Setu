'use client';

import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { createImagingReport, getPatientImaging, ImagingReport } from '@/lib/api';

interface ImagingTabProps {
  patientId: string;
  imaging: ImagingReport[];
  onImagingUpdate?: (imaging: ImagingReport[]) => void;
}

export function ImagingTab({ patientId, imaging, onImagingUpdate }: ImagingTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studyDate: '', modality: 'CT', bodyPart: '', indication: '', findings: '', impression: '' });

  const handleAdd = async () => {
    if (!form.studyDate || !form.modality || !form.bodyPart) return alert('Fill required fields');
    try {
      await createImagingReport(patientId, { ...form, source: 'manual' });
      setForm({ studyDate: '', modality: 'CT', bodyPart: '', indication: '', findings: '', impression: '' });
      setShowForm(false);
      if (onImagingUpdate) {
        const updated = await getPatientImaging(patientId);
        onImagingUpdate(updated);
      }
    } catch { alert('Failed to create imaging report'); }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Imaging</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.studyDate} onChange={e => setForm({ ...form, studyDate: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <select value={form.modality} onChange={e => setForm({ ...form, modality: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
              {['CT', 'MRI', 'PET', 'Ultrasound', 'X-Ray', 'Mammogram'].map(m => <option key={m}>{m}</option>)}
            </select>
            <input placeholder="Body Part" value={form.bodyPart} onChange={e => setForm({ ...form, bodyPart: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
            <textarea placeholder="Indication" value={form.indication} onChange={e => setForm({ ...form, indication: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" rows={2} />
            <textarea placeholder="Findings" value={form.findings} onChange={e => setForm({ ...form, findings: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" rows={2} />
            <textarea placeholder="Impression" value={form.impression} onChange={e => setForm({ ...form, impression: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" rows={2} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white">Create</button>
            <button onClick={() => setShowForm(false)} className="flex-1 rounded bg-gray-300 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {imaging.map(i => (
          <div key={i.id} className="rounded border border-gray-200 p-3">
            <div className="font-semibold text-sm">{i.modality}</div>
            <div className="text-xs text-gray-500">{i.bodyPart} • {new Date(i.studyDate).toLocaleDateString()}</div>
            {i.findings && <p className="mt-1 text-sm text-gray-700">{i.findings}</p>}
          </div>
        ))}
        {imaging.length === 0 && <p className="text-gray-400">No imaging reports yet.</p>}
      </div>
    </div>
  );
}
