'use client';

import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { createAppointment, getPatientAppointments, Appointment } from '@/lib/api';

interface AppointmentsTabProps {
  patientId: string;
  appointments: Appointment[];
  onAppointmentsUpdate: (appts: Appointment[]) => void;
}

export function AppointmentsTab({ patientId, appointments, onAppointmentsUpdate }: AppointmentsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: '', scheduledAt: '', notes: '', status: 'pending' as const });

  const handleCreate = async () => {
    if (!form.type || !form.scheduledAt) return alert('Fill required fields');
    try {
      await createAppointment(patientId, form);
      setForm({ type: '', scheduledAt: '', notes: '', status: 'pending' });
      setShowForm(false);
      const updated = await getPatientAppointments(patientId);
      onAppointmentsUpdate(updated);
    } catch { alert('Failed to create appointment'); }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Appointments</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">
          <FiPlus /> New
        </button>
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Type (e.g. Chemotherapy)" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="rounded border px-3 py-2 text-sm col-span-2" />
            <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} className="rounded border px-3 py-2 text-sm col-span-2" />
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="rounded border px-3 py-2 text-sm col-span-2" rows={2} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white">Create</button>
            <button onClick={() => setShowForm(false)} className="flex-1 rounded bg-gray-300 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {appointments.map(a => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <div className="font-semibold text-gray-800">{a.type}</div>
              <div className="text-sm text-gray-500">{new Date(a.scheduledAt).toLocaleString()}</div>
              {a.notes && <div className="text-sm text-gray-500 mt-1">{a.notes}</div>}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${a.status === 'confirmed' ? 'bg-green-100 text-green-800' : a.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>{a.status}</span>
          </div>
        ))}
        {appointments.length === 0 && <p className="text-gray-400">No appointments yet.</p>}
      </div>
    </div>
  );
}
