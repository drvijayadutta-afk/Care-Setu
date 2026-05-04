'use client';

import { Checkin } from '@/lib/api';
import { TrendChart } from '@/components/TrendChart';

interface CheckinsTabProps {
  checkins: Checkin[];
}

const SCORE_CONFIG: Record<number, { label: string; cls: string }> = {
  1: { label: 'Very Unwell',     cls: 'bg-red-100 text-red-800' },
  2: { label: 'Unwell',          cls: 'bg-orange-100 text-orange-800' },
  3: { label: 'Moderate',        cls: 'bg-yellow-100 text-yellow-800' },
  4: { label: 'Doing Well',      cls: 'bg-lime-100 text-lime-800' },
  5: { label: 'Feeling Good',    cls: 'bg-green-100 text-green-800' },
};

const SYMPTOM_LABELS: Record<string, string> = {
  fatigue:          'Fatigue / Tiredness',
  nausea:           'Nausea',
  vomiting:         'Vomiting',
  pain:             'Pain',
  fever:            'Fever',
  diarrhoea:        'Diarrhoea',
  constipation:     'Constipation',
  appetite_loss:    'Loss of Appetite',
  weakness:         'Weakness',
  breathlessness:   'Breathlessness',
  mouth_sores:      'Mouth Sores',
  hair_loss:        'Hair Loss',
  skin_rash:        'Skin Rash',
  numbness:         'Numbness / Tingling',
  swelling:         'Swelling',
};

function symptomLabel(s: string): string {
  return SYMPTOM_LABELS[s.toLowerCase()] ?? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function CheckinsTab({ checkins }: CheckinsTabProps) {
  if (checkins.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
        <p className="text-gray-500 text-sm">No patient check-ins yet.</p>
        <p className="text-gray-400 text-xs mt-1">Check-ins are sent automatically via WhatsApp and will appear here once the patient responds.</p>
      </div>
    );
  }

  // Build trend data — newest first from API, so reverse for chronological chart
  const chronological = [...checkins].reverse();
  const trendData = chronological.map(c => ({
    date: c.createdAt,
    value: (c as any).score as number,
  })).filter(d => d.value >= 1 && d.value <= 5);

  // Average of last 7 check-ins
  const recent = trendData.slice(-7);
  const avg = recent.length > 0 ? (recent.reduce((s, d) => s + d.value, 0) / recent.length).toFixed(1) : null;
  const concernCount = recent.filter(d => d.value <= 2).length;

  return (
    <div>
      {/* Trend Chart */}
      {trendData.length >= 2 && (
        <div className="mb-5 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-indigo-800">Wellbeing Score Trend</span>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {avg && <span>7-day average: <strong className={parseFloat(avg) <= 2 ? 'text-red-600' : 'text-gray-700'}>{avg}/5</strong></span>}
              {concernCount > 0 && (
                <span className="text-red-600 font-medium">{concernCount} low-score day{concernCount > 1 ? 's' : ''} this week</span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-indigo-500 mb-2">
            Score 1 = very unwell · 5 = feeling good · green band = target (≥3)
          </p>
          <div className="bg-white rounded border border-indigo-200 p-2">
            <TrendChart
              data={trendData}
              refMin={3}
              refMax={5}
              unit="/5"
              height={100}
            />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mb-4">
        Patient self-reported wellbeing scores sent via WhatsApp. Score 1 = very unwell · 5 = feeling good.
      </p>
      <div className="space-y-3">
        {checkins.map(c => {
          const score = (c as any).score as number;
          const symptoms: string[] = (c as any).symptoms ?? [];
          const notes: string = (c as any).notes ?? '';
          const cfg = SCORE_CONFIG[score] ?? { label: `Score ${score}`, cls: 'bg-gray-100 text-gray-700' };

          return (
            <div key={c.id} className={`rounded-lg border p-4 ${score <= 2 ? 'border-red-200 bg-red-50' : score === 3 ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${cfg.cls}`}>
                    {score}/5 — {cfg.label}
                  </span>
                  {score <= 2 && (
                    <span className="text-xs text-red-600 font-medium">Needs attention</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                  {new Date(c.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {symptoms.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="text-xs text-gray-500 self-center">Reported: </span>
                  {symptoms.map(s => (
                    <span key={s} className="rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-xs text-gray-700">
                      {symptomLabel(s)}
                    </span>
                  ))}
                </div>
              )}

              {notes && (
                <p className="mt-2 text-sm text-gray-600 italic">"{notes}"</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
