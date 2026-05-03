'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiUserPlus } from 'react-icons/fi';
import { useCoordinatorStore } from '@/lib/store';
import { createPatient } from '@/lib/api';
import { toast } from '@/lib/toast';

const CANCER_TYPES = [
  'Breast Cancer', 'Cervical Cancer', 'Colorectal Cancer', 'Lung Cancer',
  'Prostate Cancer', 'Stomach Cancer', 'Liver Cancer', 'Pancreatic Cancer',
  'Ovarian Cancer', 'Head & Neck Cancer', 'Lymphoma', 'Leukemia', 'Other',
];

export default function NewPatientPage() {
  const router = useRouter();
  const { coordinatorRole } = useCoordinatorStore();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: '',
    whatsappNumber: '',
    cancerType: '',
    stage: '',
    gender: '',
    dateOfBirth: '',
    hospitalName: '',
    doctorName: '',
  });

  // Gate: ADMIN only
  useEffect(() => {
    if (coordinatorRole && coordinatorRole !== 'ADMIN') {
      toast({ type: 'error', message: 'Admin role required to add patients' });
      router.push('/dashboard');
    }
  }, [coordinatorRole, router]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.cancerType) e.cancerType = 'Required';
    if (!form.hospitalName.trim()) e.hospitalName = 'Required';
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const patient = await createPatient({
        name: form.name.trim(),
        whatsappNumber: form.whatsappNumber.trim() || undefined,
        cancerType: form.cancerType,
        stage: form.stage.trim() || undefined,
        gender: form.gender || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        hospitalName: form.hospitalName.trim(),
        doctorName: form.doctorName.trim() || undefined,
      });
      toast({ type: 'success', message: 'Patient added successfully' });
      router.push(`/dashboard/patients/${patient.id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to add patient';
      toast({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (coordinatorRole && coordinatorRole !== 'ADMIN') return null;

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <FiArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-1">
          <FiUserPlus className="text-indigo-600" size={24} />
          <h1 className="text-2xl font-bold text-gray-900">Add Patient</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Manually register a patient — for clinic walk-ins, referrals, or patients without WhatsApp access.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                errors.name ? 'border-red-400' : 'border-gray-300'
              }`}
              placeholder="e.g., Sarah Mitchell"
              disabled={submitting}
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          {/* WhatsApp + Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp Number
              </label>
              <input
                type="tel"
                value={form.whatsappNumber}
                onChange={e => setForm({ ...form, whatsappNumber: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="971501234567 (optional)"
                disabled={submitting}
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank if patient has no WhatsApp</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={form.gender}
                onChange={e => setForm({ ...form, gender: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={submitting}
              >
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* DOB + Stage */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={e => setForm({ ...form, dateOfBirth: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <input
                type="text"
                value={form.stage}
                onChange={e => setForm({ ...form, stage: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., IIIB, T2N1M0"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Cancer type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cancer Type <span className="text-red-500">*</span>
            </label>
            <select
              value={form.cancerType}
              onChange={e => setForm({ ...form, cancerType: e.target.value })}
              className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                errors.cancerType ? 'border-red-400' : 'border-gray-300'
              }`}
              disabled={submitting}
            >
              <option value="">Select cancer type…</option>
              {CANCER_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.cancerType && <p className="text-xs text-red-600 mt-1">{errors.cancerType}</p>}
          </div>

          {/* Hospital + Doctor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hospital Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.hospitalName}
                onChange={e => setForm({ ...form, hospitalName: e.target.value })}
                className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.hospitalName ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="e.g., Apollo Chennai"
                disabled={submitting}
              />
              {errors.hospitalName && <p className="text-xs text-red-600 mt-1">{errors.hospitalName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Treating Doctor</label>
              <input
                type="text"
                value={form.doctorName}
                onChange={e => setForm({ ...form, doctorName: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Dr. Name (optional)"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <Link href="/dashboard" className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {submitting ? 'Adding…' : 'Add Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
