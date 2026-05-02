'use client';

import { useEffect, useState } from 'react';
import { getPatients, Patient } from '@/lib/api';
import Link from 'next/link';
import { FiSearch } from 'react-icons/fi';

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filtered, setFiltered] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const data = await getPatients();
        setPatients(Array.isArray(data) ? data : []);
        setFiltered(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error loading patients:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPatients();
  }, []);

  useEffect(() => {
    const searchTerm = search.toLowerCase();
    setFiltered(
      patients.filter(
        (p) =>
          p.whatsappNumber.includes(searchTerm) ||
          (p.name && p.name.toLowerCase().includes(searchTerm)) ||
          (p.cancerType && p.cancerType.toLowerCase().includes(searchTerm))
      )
    );
  }, [search, patients]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Patients</h1>
        <p className="mt-2 text-gray-600">Manage and monitor all patients</p>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by phone, name, or cancer type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Name
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Phone
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Cancer Type
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Age
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  Loading patients...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  {search ? 'No patients found' : 'No patients yet'}
                </td>
              </tr>
            ) : (
              filtered.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/patients/${patient.id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-900"
                    >
                      {patient.name || 'Unnamed'}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {patient.whatsappNumber}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {patient.cancerType || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {patient.age || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        patient.onboardingStep >= 9
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {patient.onboardingStep >= 9
                        ? 'Onboarded'
                        : `Step ${patient.onboardingStep}/9`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(patient.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
