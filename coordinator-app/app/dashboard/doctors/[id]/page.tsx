'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FiUser, FiPhone, FiMail, FiArrowLeft, FiCalendar, FiEdit2, FiSave } from 'react-icons/fi';
import { getDoctor, updateDoctor, Doctor } from '@/lib/api';
import { useCoordinatorStore } from '@/lib/store';
import { toast } from '@/lib/toast';

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Doctor>>({});
  const [saving, setSaving] = useState(false);
  const { coordinatorRole } = useCoordinatorStore();
  const isAdmin = coordinatorRole === 'ADMIN';

  useEffect(() => {
    if (!id) return;
    getDoctor(id).then(d => { setDoctor(d); setForm(d); }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await updateDoctor(id, form);
      setDoctor(updated);
      setEditing(false);
      toast({ type: 'success', message: 'Profile updated' });
    } catch {
      toast({ type: 'error', message: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;
  if (!doctor) return <div className="p-6 text-red-500">Doctor not found</div>;

  const field = (label: string, key: keyof Doctor) => (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      {editing ? (
        <input
          value={(form[key] as string) ?? ''}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      ) : (
        <div className="font-medium text-gray-800">{(doctor[key] as string) || <span className="text-gray-400 text-sm">—</span>}</div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Link href="/dashboard/doctors" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <FiArrowLeft size={14} /> Doctor Directory
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        {doctor.photoUrl ? (
          <img src={doctor.photoUrl} alt={doctor.name} className="h-20 w-20 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 flex-shrink-0">
            <FiUser size={32} className="text-indigo-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Dr. {doctor.name}</h1>
          <div className="text-indigo-600 font-medium">{doctor.specialization}</div>
          {doctor.department && <div className="text-gray-500 text-sm">{doctor.department}, {doctor.hospitalName}</div>}
          {doctor.registrationNumber && <div className="text-xs text-gray-400 mt-1">Reg. {doctor.registrationNumber}</div>}
          {doctor.qualifications?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {doctor.qualifications.map((q: string) => (
                <span key={q} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{q}</span>
              ))}
            </div>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-400">
                  <FiSave size={13} /> {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <FiEdit2 size={13} /> Edit
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Profile details */}
        <div className="rounded-lg border border-gray-200 p-4 space-y-4">
          <h3 className="font-semibold text-gray-800">Profile</h3>
          {field('Hospital', 'hospitalName')}
          {field('Experience', 'experienceYears')}
          {field('Bio', 'bio')}
          {field('Availability', 'availabilityNotes')}
        </div>

        {/* Contact */}
        <div className="rounded-lg border border-gray-200 p-4 space-y-4">
          <h3 className="font-semibold text-gray-800">Contact</h3>
          <div className="flex items-center gap-2 text-sm">
            <FiPhone size={14} className="text-gray-400" />
            {doctor.whatsappNumber}
            <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${doctor.isOptedIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {doctor.isOptedIn ? 'WhatsApp opted in' : 'Not opted in'}
            </span>
          </div>
          {doctor.secondaryPhone && <div className="flex items-center gap-2 text-sm"><FiPhone size={14} className="text-gray-400" />{doctor.secondaryPhone}</div>}
          {doctor.email && <div className="flex items-center gap-2 text-sm"><FiMail size={14} className="text-gray-400" />{doctor.email}</div>}
          {field('Email', 'email')}
        </div>
      </div>

      {/* Patients */}
      {doctor.patients?.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 font-semibold text-gray-800">Assigned Patients ({doctor.patients.length})</h3>
          <div className="space-y-1">
            {doctor.patients.map((p: any) => (
              <Link key={p.id} href={`/dashboard/patients/${p.id}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 hover:bg-gray-100 text-sm">
                <span className="font-medium">{p.name}</span>
                <div className="flex gap-2 text-gray-500">
                  <span>{p.cancerType}</span>
                  {p.stage && <span>· {p.stage}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Active referrals */}
      {doctor.referralsTo?.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 font-semibold text-gray-800">Pending Referrals</h3>
          <div className="space-y-2">
            {doctor.referralsTo.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2 text-sm">
                <span className="font-medium">{r.patient.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.urgency === 'emergency' ? 'bg-red-100 text-red-700' : r.urgency === 'urgent' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                    {r.urgency}
                  </span>
                  <span className="flex items-center gap-1 text-gray-400"><FiCalendar size={11} />{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
