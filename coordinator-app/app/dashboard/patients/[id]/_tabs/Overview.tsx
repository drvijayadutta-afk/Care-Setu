'use client';

import { useState } from 'react';
import { FiRefreshCw, FiAlertTriangle, FiAlertCircle, FiActivity, FiUsers, FiHeart, FiThermometer } from 'react-icons/fi';
import { getMdtSummary, Patient, LabResult, VitalSign, CareTeamMember } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/recordRegistry';
import { toast } from '@/lib/toast';
import { Tooltip } from '@/components/Tooltip';

interface OverviewTabProps {
  patientId: string;
  patient: Patient | null;
  labResults: LabResult[];
  vitals: VitalSign[];
  careTeam: CareTeamMember[];
}

const ECOG_MEANING: Record<number, string> = {
  0: 'Fully active',
  1: 'Light activities only',
  2: 'Self-care, cannot work',
  3: 'Limited self-care',
  4: 'Bed-bound',
};

const ECOG_COLOR: Record<number, string> = {
  0: 'bg-green-100 text-green-800',
  1: 'bg-lime-100 text-lime-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-orange-100 text-orange-800',
  4: 'bg-red-100 text-red-800',
};

const FLAG_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 font-semibold',
  HIGH:     'bg-orange-100 text-orange-800',
  LOW:      'bg-blue-100 text-blue-800',
};

const FLAG_LABEL: Record<string, string> = {
  CRITICAL: '⚠ Critical',
  HIGH:     'High ↑',
  LOW:      'Low ↓',
};

export function OverviewTab({ patientId, patient, labResults, vitals, careTeam }: OverviewTabProps) {
  const [mdtSummary, setMdtSummary] = useState('');
  const [mdtLoading, setMdtLoading] = useState(false);

  const handleLoadMdtSummary = async () => {
    setMdtLoading(true);
    try {
      const { summary } = await getMdtSummary(patientId);
      setMdtSummary(summary);
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.error || 'Could not generate brief — please try again in a moment';
      toast({ type: 'error', message: msg });
    } finally {
      setMdtLoading(false);
    }
  };

  const latestVitals = vitals.length > 0 ? vitals[0] : null;
  const abnormalLabs = labResults.filter(l => l.flag && l.flag !== 'NORMAL');
  const criticalLabs = abnormalLabs.filter(l => l.flag === 'CRITICAL');
  const ecog = latestVitals?.ecogScore != null ? Math.round(latestVitals.ecogScore) : null;

  return (
    <div className="space-y-6">

      {/* At-a-glance risk strip */}
      {patient && (
        <div className="flex flex-wrap gap-2">
          {criticalLabs.length > 0 && (
            <Tooltip content={`${criticalLabs.map(l => l.testName).join(', ')} — these values are significantly outside the safe range. Review immediately.`}>
              <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 cursor-default">
                <FiAlertCircle size={13} />
                {criticalLabs.length} critical lab {criticalLabs.length === 1 ? 'value' : 'values'}
              </span>
            </Tooltip>
          )}
          {abnormalLabs.length > 0 && criticalLabs.length === 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-800">
              <FiAlertTriangle size={13} />
              {abnormalLabs.length} abnormal lab {abnormalLabs.length === 1 ? 'result' : 'results'}
            </span>
          )}
          {patient.stage && (
            <span className="rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-medium text-indigo-800">
              {patient.cancerType} — Stage {patient.stage}
            </span>
          )}
          {ecog != null && (
            <Tooltip content={`ECOG ${ecog}: ${ECOG_MEANING[ecog] ?? ''}. The ECOG scale measures how the patient's illness affects daily life (0 = fully active, 4 = bed-bound).`}>
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium cursor-default ${ECOG_COLOR[ecog] ?? 'bg-gray-100 text-gray-700'}`}>
                <FiActivity size={13} />
                ECOG {ecog} — {ECOG_MEANING[ecog]}
              </span>
            </Tooltip>
          )}
          {careTeam.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800">
              <FiUsers size={13} />
              {careTeam.length}-member care team
            </span>
          )}
        </div>
      )}

      {/* Patient Demographics */}
      {patient && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-semibold text-gray-800">Patient Details</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Detail label="Full Name"          value={patient.name} />
            <Detail label="Age"                value={patient.age ? `${patient.age} years` : undefined} />
            <Detail label="Gender"             value={patient.gender} />
            <Detail label="Hospital"           value={patient.hospitalName} />
            <Detail label="Treating Doctor"    value={patient.doctorName} />
            <Detail label="Cancer Type"        value={patient.cancerType} />
            {patient.stage && <Detail label="Stage" value={`Stage ${patient.stage}`} />}
            {patient.treatmentProtocol && <Detail label="Treatment Protocol" value={patient.treatmentProtocol} />}
          </div>
        </div>
      )}

      {/* Latest Vitals */}
      {latestVitals && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-1 font-semibold text-gray-800">Latest Vital Signs</h3>
          <p className="text-xs text-gray-500 mb-3">
            Recorded {new Date(latestVitals.recordedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {latestVitals.weight    && <VitalCard icon={<FiActivity size={14}/>}    label="Weight"             value={`${latestVitals.weight} kg`} />}
            {latestVitals.bpSystolic && (
              <VitalCard icon={<FiHeart size={14}/>} label="Blood Pressure"
                value={`${latestVitals.bpSystolic}/${latestVitals.bpDiastolic} mmHg`}
                alert={latestVitals.bpSystolic > 140} hint="Normal range: 90/60 – 140/90 mmHg" />
            )}
            {latestVitals.pulseRate  && (
              <VitalCard icon={<FiHeart size={14}/>} label="Pulse Rate"
                value={`${latestVitals.pulseRate} bpm`}
                alert={latestVitals.pulseRate > 100 || latestVitals.pulseRate < 50}
                hint="Normal resting pulse: 60–100 bpm" />
            )}
            {latestVitals.oxygenSat  && (
              <VitalCard icon={<FiActivity size={14}/>} label="Oxygen Saturation (SpO₂)"
                value={`${latestVitals.oxygenSat}%`}
                alert={latestVitals.oxygenSat < 92}
                hint="SpO₂ is the percentage of blood oxygen. Normal: 95–100%. Below 92% needs attention." />
            )}
            {latestVitals.temperature && (
              <VitalCard icon={<FiThermometer size={14}/>} label="Temperature"
                value={`${latestVitals.temperature}°C`}
                alert={latestVitals.temperature > 38}
                hint="Fever in a cancer patient (>38°C) may indicate infection — review urgently." />
            )}
            {ecog != null && (
              <div className="rounded bg-gray-50 p-3 text-center">
                <Tooltip content="ECOG measures how the patient's disease affects daily activities. 0 = fully active, 4 = completely bed-bound.">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold mb-1.5 cursor-help ${ECOG_COLOR[ecog] ?? 'bg-gray-100'}`}>
                    ECOG {ecog}
                  </span>
                </Tooltip>
                <div className="text-xs text-gray-600 leading-tight">{ECOG_MEANING[ecog]}</div>
                <div className="text-xs text-gray-400 mt-1">Performance Status</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Abnormal Labs */}
      {abnormalLabs.length > 0 && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4">
          <h3 className="mb-3 font-semibold text-red-700 flex items-center gap-1.5">
            <FiAlertTriangle size={16} /> Abnormal Lab Values
          </h3>
          <div className="space-y-1.5">
            {abnormalLabs.slice(0, 8).map(l => (
              <div key={l.id} className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm border border-red-100">
                <span className="font-medium text-gray-800">{l.testName}</span>
                <span className="text-gray-700">{l.value != null ? `${l.value} ${l.unit ?? ''}`.trim() : '—'}</span>
                <div className="flex items-center gap-2">
                  {l.refMin != null && l.refMax != null && (
                    <span className="text-xs text-gray-400">Ref: {l.refMin}–{l.refMax} {l.unit}</span>
                  )}
                  {l.flag && l.flag !== 'NORMAL' && (
                    <span className={`rounded px-2 py-0.5 text-xs ${FLAG_BADGE[l.flag] ?? 'bg-gray-100 text-gray-700'}`}>
                      {FLAG_LABEL[l.flag] ?? l.flag}
                    </span>
                  )}
                </div>
                <span className="text-gray-400 text-xs">{new Date(l.testDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Care Team */}
      {careTeam.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-semibold text-gray-800">Care Team</h3>
          <div className="flex flex-wrap gap-2">
            {careTeam.map(m => (
              <div key={m.id} className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-sm">
                <div className="font-semibold text-indigo-800">{m.name}</div>
                <div className="text-xs text-indigo-600">{ROLE_LABELS[m.role] ?? m.role}</div>
                {m.phone && <div className="text-xs text-gray-500 mt-0.5">{m.phone}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MDT Summary */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-800">Multidisciplinary Team (MDT) Brief</h3>
            <p className="text-xs text-gray-500 mt-0.5">A structured clinical summary for tumor board meetings, generated from the patient's records.</p>
          </div>
          <button onClick={handleLoadMdtSummary} disabled={mdtLoading}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:bg-gray-400 whitespace-nowrap">
            <FiRefreshCw size={14} className={mdtLoading ? 'animate-spin' : ''} />
            {mdtLoading ? 'Generating…' : 'Generate Brief'}
          </button>
        </div>
        {mdtSummary ? (
          <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-700 border border-gray-200 font-mono leading-relaxed">
            {mdtSummary}
          </pre>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            Click <strong>Generate Brief</strong> to create a structured clinical summary for this patient.
          </p>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium text-gray-800 capitalize">{value}</div>
    </div>
  );
}

function VitalCard({ label, value, alert, hint, icon }: { label: string; value: string; alert?: boolean; hint?: string; icon?: React.ReactNode }) {
  const card = (
    <div className={`rounded p-3 text-center ${alert ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
      <div className={`font-semibold text-base ${alert ? 'text-orange-700' : 'text-gray-800'}`}>{value}</div>
      <div className={`text-xs mt-1 leading-tight ${alert ? 'text-orange-600' : 'text-gray-500'}`}>{label}</div>
      {alert && <div className="text-xs text-orange-500 mt-0.5 font-medium">Outside normal range</div>}
    </div>
  );
  if (hint) return <Tooltip content={hint}>{card}</Tooltip>;
  return card;
}
