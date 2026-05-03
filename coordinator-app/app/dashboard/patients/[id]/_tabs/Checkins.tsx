'use client';

import { Checkin } from '@/lib/api';

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

  return (
    <div>
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
