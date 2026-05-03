'use client';

import { useState } from 'react';
import { FiPlus, FiHelpCircle } from 'react-icons/fi';
import { createVitalSign, getPatientVitals, VitalSign } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Tooltip } from '@/components/Tooltip';

interface VitalsTabProps {
  patientId: string;
  vitals: VitalSign[];
  onVitalsUpdate?: (vitals: VitalSign[]) => void;
}

const ECOG_OPTIONS = [
  { value: '0', label: '0 — Fully active, no restrictions' },
  { value: '1', label: '1 — Restricted in strenuous activity, light work OK' },
  { value: '2', label: '2 — Self-care OK, cannot work, up >50% of day' },
  { value: '3', label: '3 — Limited self-care, confined to bed/chair >50%' },
  { value: '4', label: '4 — Completely disabled, no self-care, bed-bound' },
];

const ECOG_BADGE: Record<number, string> = {
  0: 'bg-green-100 text-green-800',
  1: 'bg-lime-100 text-lime-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-orange-100 text-orange-800',
  4: 'bg-red-100 text-red-800',
};

const PAIN_LABELS: Record<number, string> = {
  0: 'No pain',
  1: 'Very mild', 2: 'Mild', 3: 'Moderate',
  4: 'Moderate', 5: 'Moderate',
  6: 'Severe', 7: 'Severe', 8: 'Very severe',
  9: 'Unbearable', 10: 'Worst possible',
};

const EMPTY = {
  recordedAt: new Date().toISOString().slice(0, 16),
  weight: '', height: '', temperature: '',
  bpSystolic: '', bpDiastolic: '', pulseRate: '',
  oxygenSat: '', ecogScore: '', painScore: '',
};

export function VitalsTab({ patientId, vitals, onVitalsUpdate }: VitalsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!form.recordedAt) {
      toast({ type: 'error', message: 'Please select a date and time for this reading' });
      return;
    }
    setSubmitting(true);
    try {
      await createVitalSign(patientId, {
        recordedAt: form.recordedAt,
        source: 'manual',
        weight:      form.weight      ? parseFloat(form.weight)      : undefined,
        height:      form.height      ? parseFloat(form.height)      : undefined,
        temperature: form.temperature ? parseFloat(form.temperature) : undefined,
        bpSystolic:  form.bpSystolic  ? parseFloat(form.bpSystolic)  : undefined,
        bpDiastolic: form.bpDiastolic ? parseFloat(form.bpDiastolic) : undefined,
        pulseRate:   form.pulseRate   ? parseFloat(form.pulseRate)   : undefined,
        oxygenSat:   form.oxygenSat   ? parseFloat(form.oxygenSat)   : undefined,
        ecogScore:   form.ecogScore   ? parseFloat(form.ecogScore)   : undefined,
        painScore:   form.painScore   ? parseFloat(form.painScore)   : undefined,
      });
      toast({ type: 'success', message: 'Vitals saved' });
      setForm(EMPTY);
      setShowForm(false);
      if (onVitalsUpdate) onVitalsUpdate(await getPatientVitals(patientId));
    } catch {
      toast({ type: 'error', message: 'Could not save vitals — please try again' });
    } finally {
      setSubmitting(false);
    }
  };

  const inp = 'w-full rounded border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Vital Signs</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          <FiPlus size={14} /> Record Vitals
        </button>
      </div>

      {showForm && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <p className="text-xs text-indigo-700 font-medium">Leave any field blank if not measured today.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Date/Time */}
            <div className="flex flex-col gap-1 sm:col-span-3">
              <label className="text-xs font-medium text-gray-700">Date &amp; Time of Reading *</label>
              <input type="datetime-local" value={form.recordedAt}
                onChange={e => setForm({ ...form, recordedAt: e.target.value })}
                className={inp} />
            </div>

            {/* Weight / Height */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Weight (kg)</label>
              <input placeholder="e.g. 62.5" type="number" step="0.1" min="0"
                value={form.weight}
                onChange={e => setForm({ ...form, weight: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Height (cm)</label>
              <input placeholder="e.g. 158" type="number" step="0.1" min="0"
                value={form.height}
                onChange={e => setForm({ ...form, height: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Temperature (°C)</label>
              <input placeholder="e.g. 37.2" type="number" step="0.1" min="30" max="45"
                value={form.temperature}
                onChange={e => setForm({ ...form, temperature: e.target.value })}
                className={inp} />
            </div>

            {/* BP */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Blood Pressure — Systolic (upper number, mmHg)
              </label>
              <input placeholder="e.g. 120" type="number" min="0" max="300"
                value={form.bpSystolic}
                onChange={e => setForm({ ...form, bpSystolic: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Blood Pressure — Diastolic (lower number, mmHg)
              </label>
              <input placeholder="e.g. 80" type="number" min="0" max="200"
                value={form.bpDiastolic}
                onChange={e => setForm({ ...form, bpDiastolic: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Pulse Rate (beats/min)</label>
              <input placeholder="e.g. 78" type="number" min="0" max="300"
                value={form.pulseRate}
                onChange={e => setForm({ ...form, pulseRate: e.target.value })}
                className={inp} />
            </div>

            {/* O2 / ECOG / Pain */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                Oxygen Saturation — SpO₂ (%)
                <Tooltip content="SpO₂ is the percentage of haemoglobin carrying oxygen. Normal is 95–100%. Below 92% is concerning." icon />
              </label>
              <input placeholder="e.g. 97" type="number" min="50" max="100" step="0.1"
                value={form.oxygenSat}
                onChange={e => setForm({ ...form, oxygenSat: e.target.value })}
                className={inp} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                ECOG Performance Score
                <Tooltip content="ECOG measures how the patient's disease affects daily living. 0 = fully active. 4 = bed-bound." icon />
              </label>
              <select value={form.ecogScore}
                onChange={e => setForm({ ...form, ecogScore: e.target.value })}
                className={inp}>
                <option value="">— Select —</option>
                {ECOG_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                Pain Score (0–10)
                <Tooltip content="0 = No pain at all. 10 = Worst pain imaginable. Ask the patient to rate their pain right now." icon />
              </label>
              <input placeholder="0 (no pain) – 10 (worst)" type="number" min="0" max="10" step="1"
                value={form.painScore}
                onChange={e => {
                  const v = Math.min(10, Math.max(0, parseFloat(e.target.value) || 0));
                  setForm({ ...form, painScore: String(v) });
                }}
                className={inp} />
              {form.painScore !== '' && (
                <span className="text-xs text-gray-500">
                  {PAIN_LABELS[Math.round(parseFloat(form.painScore))] ?? ''}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={submitting}
              className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Vitals'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={submitting}
              className="flex-1 rounded border border-gray-300 bg-white py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {vitals.map(v => {
          const ecog = v.ecogScore != null ? Math.round(v.ecogScore) : null;
          const pain = v.painScore != null ? Math.round(v.painScore) : null;

          return (
            <div key={v.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500 mb-3 font-medium">
                {new Date(v.recordedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {v.weight    && <Stat label="Weight"      value={`${v.weight} kg`} />}
                {v.height    && <Stat label="Height"      value={`${v.height} cm`} />}
                {v.bpSystolic && (
                  <Stat label="Blood Pressure" value={`${v.bpSystolic}/${v.bpDiastolic} mmHg`}
                    alert={v.bpSystolic > 140 || (v.bpDiastolic ?? 0) > 90} />
                )}
                {v.pulseRate  && <Stat label="Pulse" value={`${v.pulseRate} bpm`} alert={v.pulseRate > 100 || v.pulseRate < 50} />}
                {v.oxygenSat  && (
                  <Stat label="SpO₂ (Oxygen Sat.)" value={`${v.oxygenSat}%`}
                    alert={v.oxygenSat < 92} />
                )}
                {v.temperature && (
                  <Stat label="Temperature" value={`${v.temperature}°C`}
                    alert={v.temperature > 38} />
                )}
                {ecog != null && (
                  <div className="rounded bg-gray-50 p-2 text-center">
                    <div className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold mb-1 ${ECOG_BADGE[ecog] ?? 'bg-gray-100 text-gray-700'}`}>
                      ECOG {ecog}
                    </div>
                    <div className="text-gray-600 text-xs leading-tight">
                      {ECOG_OPTIONS[ecog]?.label.split('— ')[1] ?? ''}
                    </div>
                    <div className="text-gray-400 text-xs mt-0.5">Performance</div>
                  </div>
                )}
                {pain != null && (
                  <div className="rounded bg-gray-50 p-2 text-center">
                    <div className={`font-bold text-lg ${pain >= 7 ? 'text-red-600' : pain >= 4 ? 'text-orange-500' : 'text-gray-800'}`}>
                      {pain}/10
                    </div>
                    <div className="text-xs text-gray-500">{PAIN_LABELS[pain] ?? ''}</div>
                    <div className="text-gray-400 text-xs mt-0.5">Pain Score</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {vitals.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500 text-sm">No vitals recorded yet.</p>
            <p className="text-gray-400 text-xs mt-1">Click <strong>Record Vitals</strong> above to add the first reading.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded p-2 text-center ${alert ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
      <div className={`font-semibold ${alert ? 'text-orange-700' : 'text-gray-800'}`}>{value}</div>
      <div className={`text-xs mt-0.5 ${alert ? 'text-orange-600' : 'text-gray-500'}`}>{label}</div>
    </div>
  );
}
