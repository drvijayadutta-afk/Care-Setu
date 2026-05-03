'use client';

import { useState } from 'react';
import { FiPlus, FiCalendar, FiClock } from 'react-icons/fi';
import { createAppointment, getPatientAppointments, Appointment } from '@/lib/api';
import { toast } from '@/lib/toast';

interface AppointmentsTabProps {
  patientId: string;
  appointments: Appointment[];
  onAppointmentsUpdate: (appts: Appointment[]) => void;
}

const APPOINTMENT_TYPES = [
  'Chemotherapy Session',
  'Radiation Therapy',
  'Oncology Consultation',
  'Follow-up Visit',
  'Lab Tests / Blood Work',
  'Imaging / Scan',
  'Surgery / Procedure',
  'Palliative Care',
  'Nutritionist Consultation',
  'Physiotherapy',
  'Other',
];

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Scheduled',  cls: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmed',  cls: 'bg-green-100 text-green-800' },
  completed: { label: 'Completed',  cls: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'Cancelled',  cls: 'bg-gray-100 text-gray-500' },
};

const inp = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

export function AppointmentsTab({ patientId, appointments, onAppointmentsUpdate }: AppointmentsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: '', scheduledAt: '', notes: '', status: 'pending' as const });
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!form.type) {
      toast({ type: 'error', message: 'Please select an appointment type' });
      return;
    }
    if (!form.scheduledAt) {
      toast({ type: 'error', message: 'Please select a date and time for the appointment' });
      return;
    }
    setSubmitting(true);
    try {
      await createAppointment(patientId, form);
      setForm({ type: '', scheduledAt: '', notes: '', status: 'pending' });
      setShowForm(false);
      toast({ type: 'success', message: 'Appointment scheduled' });
      const updated = await getPatientAppointments(patientId);
      onAppointmentsUpdate(updated);
    } catch {
      toast({ type: 'error', message: 'Could not schedule appointment — please try again' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Appointments</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          <FiPlus size={14} /> Schedule Appointment
        </button>
      </div>

      {showForm && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <p className="text-xs text-indigo-700 font-medium">Fields marked * are required.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Appointment Type *</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inp}>
                <option value="">— Select type —</option>
                {APPOINTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Date &amp; Time *</label>
              <input type="datetime-local" value={form.scheduledAt}
                onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Notes (optional)</label>
              <textarea placeholder="Any special instructions, location, or preparation needed…"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className={inp} rows={2} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={submitting}
              className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Appointment'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={submitting}
              className="flex-1 rounded border border-gray-300 bg-white py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {appointments.map(a => {
          const cfg = STATUS_CONFIG[a.status] ?? { label: a.status, cls: 'bg-gray-100 text-gray-700' };
          const apptDate = new Date(a.scheduledAt);
          return (
            <div key={a.id} className={`rounded-lg border p-4 ${a.status === 'cancelled' ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-indigo-50 p-2 text-indigo-600 flex-shrink-0">
                    <FiCalendar size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">{a.type}</div>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                      <FiClock size={12} />
                      {apptDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      {' at '}
                      {apptDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {a.notes && (
                      <p className="mt-1.5 text-sm text-gray-600">{a.notes}</p>
                    )}
                  </div>
                </div>
                <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${cfg.cls}`}>
                  {cfg.label}
                </span>
              </div>
            </div>
          );
        })}

        {appointments.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <FiCalendar size={24} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm font-medium">No appointments scheduled yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Click <strong>Schedule Appointment</strong> above to add the patient's next visit or treatment session.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
