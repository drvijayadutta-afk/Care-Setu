'use client';

import { Checkin } from '@/lib/api';

interface CheckinsTabProps {
  checkins: Checkin[];
}

export function CheckinsTab({ checkins }: CheckinsTabProps) {
  return (
    <div className="space-y-3">
      {checkins.length === 0 ? (
        <p className="text-gray-400">No check-ins yet.</p>
      ) : (
        checkins.map(c => (
          <div key={c.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-start">
              <div>
                <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${(c as any).score >= 4 ? 'bg-green-100 text-green-800' : (c as any).score >= 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                  Score {(c as any).score}/5
                </span>
                {(c as any).symptoms?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(c as any).symptoms.map((s: string) => (
                      <span key={s} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{s}</span>
                    ))}
                  </div>
                )}
                {(c as any).notes && <p className="mt-1 text-sm text-gray-600">{(c as any).notes}</p>}
              </div>
              <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
