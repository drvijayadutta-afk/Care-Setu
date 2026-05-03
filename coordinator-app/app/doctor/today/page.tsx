'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

type Urgency = 'critical' | 'notable' | 'stable';

interface Card {
  appointmentId: string;
  patientId: string;
  patientInitials: string;
  age?: number;
  cancerType?: string;
  stage?: string;
  protocol?: string;
  cycle?: number;
  scheduledAt: string;
  appointmentType: string;
  urgency: Urgency;
  changeSummary: string;
}

interface Brief {
  date: string;
  totals: { critical: number; notable: number; stable: number; total: number };
  cards: Card[];
}

const URGENCY_STYLE: Record<Urgency, { dot: string; bar: string; emoji: string; label: string }> = {
  critical: { dot: 'bg-red-500', bar: 'border-l-4 border-red-500', emoji: '🔴', label: 'Critical' },
  notable: { dot: 'bg-amber-500', bar: 'border-l-4 border-amber-400', emoji: '🟡', label: 'Notable' },
  stable: { dot: 'bg-emerald-500', bar: 'border-l-4 border-emerald-400', emoji: '🟢', label: 'Stable' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DoctorTodayPage() {
  const router = useRouter();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [doctorName, setDoctorName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      axios.get(`${API_URL}/auth/doctor/me`, { withCredentials: true }),
      axios.get(`${API_URL}/doctor/today`, { withCredentials: true }),
    ])
      .then(([meRes, briefRes]) => {
        if (cancelled) return;
        setDoctorName(meRes.data.name || '');
        setBrief(briefRes.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 401) {
          router.replace('/doctor/login');
        } else {
          setError('Could not load your day. Pull to refresh.');
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-gray-600">{error || 'No data'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-12 pt-6">
      {/* Header */}
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">
          {new Date(brief.date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">
          {doctorName ? `Good morning, Dr. ${doctorName.split(' ').pop()}` : 'Your day'}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {brief.totals.total === 0
            ? 'No patients scheduled today.'
            : `${brief.totals.total} patient${brief.totals.total === 1 ? '' : 's'} today`}
        </p>
      </header>

      {/* Totals strip */}
      {brief.totals.total > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-red-50 p-3 text-center">
            <div className="text-2xl font-semibold text-red-700">{brief.totals.critical}</div>
            <div className="text-[10px] uppercase tracking-wide text-red-700">Critical</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-center">
            <div className="text-2xl font-semibold text-amber-700">{brief.totals.notable}</div>
            <div className="text-[10px] uppercase tracking-wide text-amber-700">Notable</div>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3 text-center">
            <div className="text-2xl font-semibold text-emerald-700">{brief.totals.stable}</div>
            <div className="text-[10px] uppercase tracking-wide text-emerald-700">Stable</div>
          </div>
        </div>
      )}

      {/* Card stack */}
      <div className="space-y-3">
        {brief.cards.map((card) => {
          const style = URGENCY_STYLE[card.urgency];
          return (
            <button
              key={card.appointmentId}
              onClick={() => router.push(`/doctor/patients/${card.patientId}`)}
              className={`w-full rounded-lg bg-white text-left shadow-sm transition active:scale-[0.99] ${style.bar}`}
            >
              <div className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {card.patientInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-gray-900">
                      {card.patientInitials}
                      {card.age != null && <span className="ml-1 text-xs font-normal text-gray-500">· {card.age}y</span>}
                    </div>
                    <div className="text-xs text-gray-500">{formatTime(card.scheduledAt)}</div>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-600">
                    {[card.cancerType, card.stage && `Stage ${card.stage}`, card.protocol, card.cycle && `Cycle ${card.cycle}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <span aria-hidden className="mt-0.5">{style.emoji}</span>
                    <p className="text-sm text-gray-800">{card.changeSummary}</p>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
