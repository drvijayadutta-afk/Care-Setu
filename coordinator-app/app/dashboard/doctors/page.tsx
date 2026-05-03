'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiUser, FiPhone, FiMail, FiSearch, FiPlus } from 'react-icons/fi';
import { getDoctors, createDoctor, Doctor } from '@/lib/api';
import { useCoordinatorStore } from '@/lib/store';
import { toast } from '@/lib/toast';

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<(Doctor & { _count: { patients: number; careTeamMembers: number } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', whatsappNumber: '', hospitalName: '', specialization: '', registrationNumber: '', department: '', email: '' });
  const [saving, setSaving] = useState(false);
  const { coordinatorRole } = useCoordinatorStore();
  const isAdmin = coordinatorRole === 'ADMIN';

  useEffect(() => {
    getDoctors().then(setDoctors).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = doctors.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.specialization.toLowerCase().includes(search.toLowerCase()) ||
    d.hospitalName.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const doc = await createDoctor(form);
      setDoctors(prev => [doc as any, ...prev]);
      setShowAdd(false);
      setForm({ name: '', whatsappNumber: '', hospitalName: '', specialization: '', registrationNumber: '', department: '', email: '' });
      toast({ type: 'success', message: `Dr. ${doc.name} added` });
    } catch (e: any) {
      toast({ type: 'error', message: e?.response?.data?.error || 'Failed to add doctor' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Doctor Directory</h1>
          <p className="text-sm text-gray-500 mt-0.5">{doctors.length} doctors on record</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <FiPlus size={14} /> Add Doctor
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, specialization, hospital…"
          className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm outline-none focus:border-indigo-500"
        />
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <h3 className="font-semibold text-indigo-900">Add Doctor</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['name', 'Full Name *'],
              ['whatsappNumber', 'WhatsApp Number *'],
              ['hospitalName', 'Hospital *'],
              ['specialization', 'Specialization'],
              ['registrationNumber', 'MCI/NMC Reg. No.'],
              ['department', 'Department'],
              ['email', 'Email'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input
                  value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                  required={label.endsWith('*')}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-400">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Doctor grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No doctors found</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(doc => (
            <Link key={doc.id} href={`/dashboard/doctors/${doc.id}`} className="block rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                {doc.photoUrl ? (
                  <img src={doc.photoUrl} alt={doc.name} className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 flex-shrink-0">
                    <FiUser size={22} className="text-indigo-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900 truncate">Dr. {doc.name}</div>
                  <div className="text-sm text-indigo-600">{doc.specialization}</div>
                  {doc.department && <div className="text-xs text-gray-500">{doc.department}</div>}
                </div>
              </div>
              {doc.registrationNumber && (
                <div className="mt-2 text-xs text-gray-500">Reg: {doc.registrationNumber}</div>
              )}
              <div className="mt-2 text-xs text-gray-600">{doc.hospitalName}</div>
              {doc.qualifications.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {doc.qualifications.slice(0, 3).map(q => (
                    <span key={q} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{q}</span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-3 text-xs text-gray-400">
                <span>{doc._count.patients} patients</span>
                <span>{doc._count.careTeamMembers} care teams</span>
              </div>
              {(doc.email || doc.secondaryPhone) && (
                <div className="mt-2 flex gap-3">
                  {doc.email && <span className="flex items-center gap-1 text-xs text-gray-400"><FiMail size={11} />{doc.email}</span>}
                  {doc.secondaryPhone && <span className="flex items-center gap-1 text-xs text-gray-400"><FiPhone size={11} />{doc.secondaryPhone}</span>}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
