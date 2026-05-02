'use client';

import { useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { getMdtSummary, Patient, LabResult, VitalSign, CareTeamMember } from '@/lib/api';
import { ROLE_LABELS, FLAG_COLORS } from '@/lib/recordRegistry';

interface OverviewTabProps {
  patientId: string;
  patient: Patient | null;
  labResults: LabResult[];
  vitals: VitalSign[];
  careTeam: CareTeamMember[];
}

export function OverviewTab({ patientId, patient, labResults, vitals, careTeam }: OverviewTabProps) {
  const [mdtSummary, setMdtSummary] = useState('');
  const [mdtLoading, setMdtLoading] = useState(false);

  const handleLoadMdtSummary = async () => {
    setMdtLoading(true);
    try {
      const summary = await getMdtSummary(patientId);
      setMdtSummary(summary);
    } catch (e) {
      console.error(e);
      alert('Failed to generate MDT summary');
    } finally {
      setMdtLoading(false);
    }
  };

  const latestVitals = vitals.length > 0 ? vitals[0] : null;
  const abnormalLabs = labResults.filter(l => l.flag && l.flag !== 'NORMAL');

  return (
    <div className="space-y-6">
      {/* Patient Demographics */}
      {patient && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 font-semibold text-gray-800">Demographics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500">Name</div>
              <div className="font-semibold text-gray-800">{patient.name || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Age</div>
              <div className="font-semibold text-gray-800">{patient.age || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Gender</div>
              <div className="font-semibold text-gray-800">{patient.gender?.toUpperCase() || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Hospital</div>
              <div className="font-semibold text-gray-800">{patient.hospitalName || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Latest Vitals */}
      {latestVitals && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 font-semibold text-gray-800">Latest Vitals</h3>
          <div className="grid grid-cols-3 gap-2">
            {latestVitals.weight && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.weight} kg</div><div className="text-gray-500 text-xs">Weight</div></div>}
            {latestVitals.height && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.height} cm</div><div className="text-gray-500 text-xs">Height</div></div>}
            {latestVitals.bpSystolic && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.bpSystolic}/{latestVitals.bpDiastolic}</div><div className="text-gray-500 text-xs">BP (mmHg)</div></div>}
            {latestVitals.pulseRate && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.pulseRate}</div><div className="text-gray-500 text-xs">Pulse/min</div></div>}
            {latestVitals.oxygenSat && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.oxygenSat}%</div><div className="text-gray-500 text-xs">SpO₂</div></div>}
            {latestVitals.temperature && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.temperature}°C</div><div className="text-gray-500 text-xs">Temp</div></div>}
            {latestVitals.ecogScore != null && <div className="rounded bg-gray-50 p-2 text-center"><div className="font-bold">{latestVitals.ecogScore}</div><div className="text-gray-500 text-xs">ECOG</div></div>}
          </div>
        </div>
      )}

      {/* Abnormal Labs */}
      {abnormalLabs.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 font-semibold text-red-700">Abnormal Lab Values</h3>
          <div className="space-y-1">
            {abnormalLabs.slice(0, 8).map(l => (
              <div key={l.id} className="flex items-center justify-between rounded bg-red-50 px-3 py-2 text-sm">
                <span className="font-medium">{l.testName}</span>
                <span>{l.value} {l.unit}</span>
                {l.flag && <span className={`rounded px-2 py-0.5 text-xs ${FLAG_COLORS[l.flag] ?? 'bg-gray-100'}`}>{l.flag}</span>}
                <span className="text-gray-400 text-xs">{new Date(l.testDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Care Team Preview */}
      {careTeam.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 font-semibold text-gray-800">Care Team</h3>
          <div className="flex flex-wrap gap-2">
            {careTeam.map(m => (
              <div key={m.id} className="rounded-lg bg-indigo-50 px-3 py-2 text-sm">
                <div className="font-semibold text-indigo-800">{m.name}</div>
                <div className="text-xs text-indigo-600">{ROLE_LABELS[m.role] ?? m.role}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MDT Summary */}
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">AI MDT Brief</h3>
          <button onClick={handleLoadMdtSummary} disabled={mdtLoading}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:bg-gray-400">
            <FiRefreshCw className={mdtLoading ? 'animate-spin' : ''} />
            {mdtLoading ? 'Generating...' : 'Generate MDT Brief'}
          </button>
        </div>
        {mdtSummary && (
          <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-700 border border-gray-200 font-sans leading-relaxed">
            {mdtSummary}
          </pre>
        )}
      </div>
    </div>
  );
}
