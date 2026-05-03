'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

interface PatientDetail {
  id: string;
  name: string;
  cancerType: string;
  stage?: string;
  treatmentProtocol: string;
  currentCycle: number;
  hospitalName: string;
  doctorName: string;
  dateOfBirth?: string;
  gender?: string;
  histology?: string;
  diagnosisDate?: string;
  ecogScore?: number;
  bloodGroup?: string;
  allergies: string[];
  comorbidities: string[];
}

interface RecentCheckin {
  id: string;
  score: number;
  symptoms: string[];
  cycleDay: number;
  createdAt: string;
}

interface RecentAlert {
  id: string;
  severity: string;
  message: string;
  resolved: boolean;
  createdAt: string;
}

interface Appointment {
  id: string;
  scheduledAt: string;
  type: string;
  status: string;
}

function ageFrom(dob?: string): number | null {
  if (!dob) return null;
  const ms = Date.now() - new Date(dob).getTime();
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const SCORE_COLOUR = (s: number) =>
  s <= 1 ? 'text-red-600' : s <= 2 ? 'text-amber-600' : s <= 3 ? 'text-yellow-600' : 'text-emerald-600';

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

export default function DoctorPatientPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params?.id as string;

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [checkins, setCheckins] = useState<RecentCheckin[]>([]);
  const [alerts, setAlerts] = useState<RecentAlert[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;

    Promise.all([
      axios.get(`${API_URL}/patients/${patientId}`, { withCredentials: true }),
      axios.get(`${API_URL}/patients/${patientId}/checkins?limit=7`, { withCredentials: true }),
      axios.get(`${API_URL}/patients/${patientId}/alerts?limit=5`, { withCredentials: true }),
      axios.get(`${API_URL}/patients/${patientId}/appointments?limit=5`, { withCredentials: true }),
    ])
      .then(([pRes, cRes, aRes, apptRes]) => {
        if (cancelled) return;
        setPatient(pRes.data);
        setCheckins(cRes.data?.checkins ?? cRes.data ?? []);
        setAlerts(aRes.data?.alerts ?? aRes.data ?? []);
        setAppointments(apptRes.data?.appointments ?? apptRes.data ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 401) router.replace('/doctor/login');
        else setError('Could not load patient record.');
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [patientId, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-gray-600">{error || 'Patient not found.'}</p>
      </div>
    );
  }

  const age = ageFrom(patient.dateOfBirth);
  const activeAlerts = alerts.filter((a) => !a.resolved);

  return (
    <div className="mx-auto max-w-md pb-16">

      {/* Header / back */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
          aria-label="Back"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{patient.name}</p>
          <p className="text-xs text-gray-500">
            {patient.cancerType}{patient.stage ? ` · ${patient.stage}` : ''}
            {age != null ? ` · ${age}y` : ''}
          </p>
        </div>
        {activeAlerts.length > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {activeAlerts.length}
          </span>
        )}
      </div>

      <div className="space-y-4 px-4 pt-4">

        {/* Clinical identity */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Clinical Identity</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">Protocol</dt>
            <dd className="font-medium text-gray-900">{patient.treatmentProtocol}</dd>
            <dt className="text-gray-500">Cycle</dt>
            <dd className="font-medium text-gray-900">{patient.currentCycle}</dd>
            <dt className="text-gray-500">Histology</dt>
            <dd className="font-medium text-gray-900">{patient.histology || '—'}</dd>
            <dt className="text-gray-500">Diagnosed</dt>
            <dd className="font-medium text-gray-900">{formatDate(patient.diagnosisDate)}</dd>
            <dt className="text-gray-500">ECOG</dt>
            <dd className="font-medium text-gray-900">{patient.ecogScore ?? '—'}</dd>
            <dt className="text-gray-500">Blood Group</dt>
            <dd className="font-medium text-gray-900">{patient.bloodGroup || '—'}</dd>
          </dl>
          {patient.allergies.length > 0 && (
            <div className="mt-2 text-sm">
              <span className="text-gray-500">Allergies: </span>
              <span className="font-medium text-red-700">{patient.allergies.join(', ')}</span>
            </div>
          )}
          {patient.comorbidities.length > 0 && (
            <div className="mt-1 text-sm">
              <span className="text-gray-500">Comorbidities: </span>
              <span className="text-gray-800">{patient.comorbidities.join(', ')}</span>
            </div>
          )}
        </section>

        {/* Active alerts */}
        {activeAlerts.length > 0 && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-600">
              ⚠️ Active Alerts ({activeAlerts.length})
            </h2>
            <div className="space-y-2">
              {activeAlerts.map((a) => (
                <div key={a.id} className="rounded-lg bg-red-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_BADGE[a.severity] ?? SEVERITY_BADGE.medium}`}>
                      {a.severity}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(a.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-800">{a.message}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent check-ins */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Recent Check-ins
          </h2>
          {checkins.length === 0 ? (
            <p className="text-sm text-gray-400">No check-ins recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {checkins.map((c) => (
                <div key={c.id} className="flex items-start gap-3 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                  <div className={`text-lg font-bold ${SCORE_COLOUR(c.score)}`}>{c.score}/5</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-500">
                      {formatDate(c.createdAt)} · Cycle day {c.cycleDay}
                    </div>
                    {c.symptoms.length > 0 && (
                      <div className="mt-0.5 text-xs text-gray-700">{c.symptoms.join(', ')}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming appointments */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Appointments
          </h2>
          {appointments.length === 0 ? (
            <p className="text-sm text-gray-400">No appointments found.</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-800">{a.type}</span>
                    <span className="ml-2 text-xs text-gray-500">{formatDate(a.scheduledAt)} {formatTime(a.scheduledAt)}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    a.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Defense Mode — Care Record */}
        <section className="rounded-xl bg-indigo-50 p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-indigo-900">🛡️ Defense Mode</h2>
          <p className="mb-3 text-xs text-indigo-700">
            Generate a complete, tamper-evident care record for medico-legal protection.
            Delivered to your verified email instantly.
          </p>
          <button
            onClick={() => router.push(`/doctor/patients/${patientId}/care-record`)}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-indigo-700"
          >
            Generate Care Record
          </button>
        </section>

      </div>
    </div>
  );
}
