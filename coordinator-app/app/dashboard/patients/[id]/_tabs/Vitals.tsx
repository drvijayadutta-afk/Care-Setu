'use client';

import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { createVitalSign, getPatientVitals, VitalSign } from '@/lib/api';

interface VitalsTabProps {
  patientId: string;
  vitals: VitalSign[];
  onVitalsUpdate?: (vitals: VitalSign[]) => void;
}

export function VitalsTab({ patientId, vitals, onVitalsUpdate }: VitalsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ recordedAt: new Date().toISOString().slice(0, 16), weight: '', height: '', temperature: '', bpSystolic: '', bpDiastolic: '', pulseRate: '', oxygenSat: '', ecogScore: '', painScore: '' });

  const handleAdd = async () => {
    if (!form.recordedAt) return alert('Fill required fields');
    try {
      const payload = {
        recordedAt: form.recordedAt,
        source: 'manual',
        weight: form.weight ? parseFloat(form.weight) : undefined,
        height: form.height ? parseFloat(form.height) : undefined,
        temperature: form.temperature ? parseFloat(form.temperature) : undefined,
        bpSystolic: form.bpSystolic ? parseFloat(form.bpSystolic) : undefined,
        bpDiastolic: form.bpDiastolic ? parseFloat(form.bpDiastolic) : undefined,
        pulseRate: form.pulseRate ? parseFloat(form.pulseRate) : undefined,
        oxygenSat: form.oxygenSat ? parseFloat(form.oxygenSat) : undefined,
        ecogScore: form.ecogScore ? parseFloat(form.ecogScore) : undefined,
        painScore: form.painScore ? parseFloat(form.painScore) : undefined,
      };
      await createVitalSign(patientId, payload);
      setForm({ recordedAt: new Date().toISOString().slice(0, 16), weight: '', height: '', temperature: '', bpSystolic: '', bpDiastolic: '', pulseRate: '', oxygenSat: '', ecogScore: '', painScore: '' });
      setShowForm(false);
      if (onVitalsUpdate) {
        const updated = await getPatientVitals(patientId);
        onVitalsUpdate(updated);
      }
    } catch { alert('Failed to create vital signs'); }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Vitals</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Add</button>
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input type="datetime-local" value={form.recordedAt} onChange={e => setForm({ ...form, recordedAt: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-3" />
            <input placeholder="Weight (kg)" type="number" step="0.1" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="Height (cm)" type="number" step="0.1" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="Temp (°C)" type="number" step="0.1" value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="BP Systolic" type="number" value={form.bpSystolic} onChange={e => setForm({ ...form, bpSystolic: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="BP Diastolic" type="number" value={form.bpDiastolic} onChange={e => setForm({ ...form, bpDiastolic: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="Pulse Rate" type="number" value={form.pulseRate} onChange={e => setForm({ ...form, pulseRate: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="O2 Sat (%)" type="number" step="0.1" value={form.oxygenSat} onChange={e => setForm({ ...form, oxygenSat: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="ECOG (0-4)" type="number" value={form.ecogScore} onChange={e => setForm({ ...form, ecogScore: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="Pain (0-10)" type="number" value={form.painScore} onChange={e => setForm({ ...form, painScore: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white">Create</button>
            <button onClick={() => setShowForm(false)} className="flex-1 rounded bg-gray-300 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {vitals.map(v => (
          <div key={v.id} className="rounded border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-2">{new Date(v.recordedAt).toLocaleString()}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {v.weight && <div><span className="text-gray-600">Weight:</span> <span className="font-semibold">{v.weight} kg</span></div>}
              {v.height && <div><span className="text-gray-600">Height:</span> <span className="font-semibold">{v.height} cm</span></div>}
              {v.bpSystolic && <div><span className="text-gray-600">BP:</span> <span className="font-semibold">{v.bpSystolic}/{v.bpDiastolic}</span></div>}
              {v.pulseRate && <div><span className="text-gray-600">Pulse:</span> <span className="font-semibold">{v.pulseRate}</span></div>}
              {v.oxygenSat && <div><span className="text-gray-600">O2 Sat:</span> <span className="font-semibold">{v.oxygenSat}%</span></div>}
              {v.temperature && <div><span className="text-gray-600">Temp:</span> <span className="font-semibold">{v.temperature}°C</span></div>}
            </div>
          </div>
        ))}
        {vitals.length === 0 && <p className="text-gray-400">No vital signs recorded yet.</p>}
      </div>
    </div>
  );
}
