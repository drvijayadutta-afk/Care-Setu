'use client';

import { useEffect, useState } from 'react';
import { getPatients, Patient, healthCheck } from '@/lib/api';
import { useCoordinatorStore } from '@/lib/store';
import Link from 'next/link';
import { FiAlertCircle, FiCheckCircle, FiClock } from 'react-icons/fi';

export default function DashboardPage() {
  const { setPatients } = useCoordinatorStore();
  const [patients, setLocalPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check if server is online
        const online = await healthCheck();
        setServerOnline(online);

        if (!online) {
          setError('Backend server is not running. Start it with: npm run dev');
          setLoading(false);
          return;
        }

        // Fetch patients
        const data = await getPatients();
        setLocalPatients(Array.isArray(data) ? data : []);
        setPatients(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data from server');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setPatients]);

  if (!serverOnline) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-red-50 p-6 text-red-700">
        <FiAlertCircle className="mr-3 text-2xl" />
        <div>
          <h3 className="font-semibold">Backend Server Not Running</h3>
          <p className="text-sm">
            Start the backend: cd .. && npm run dev (port 3000)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm text-gray-600">Total Patients</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {patients.length}
          </div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center text-sm text-gray-600">
            <FiCheckCircle className="mr-2" />
            Onboarded
          </div>
          <div className="mt-2 text-3xl font-bold text-green-600">
            {patients.filter((p) => p.onboardingStep >= 9).length}
          </div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center text-sm text-gray-600">
            <FiClock className="mr-2" />
            In Progress
          </div>
          <div className="mt-2 text-3xl font-bold text-yellow-600">
            {patients.filter((p) => p.onboardingStep < 9).length}
          </div>
        </div>
      </div>

      {/* Recent patients */}
      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Patients</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : patients.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No patients yet. Messages will appear here as they arrive.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {patients.slice(0, 10).map((patient) => (
              <Link
                key={patient.id}
                href={`/dashboard/patients/${patient.id}`}
                className="block p-6 hover:bg-indigo-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {patient.name || 'Unnamed Patient'}
                    </div>
                    <div className="text-sm text-gray-600">{patient.whatsappNumber}</div>
                    {patient.cancerType && (
                      <div className="mt-1 text-sm text-gray-600">
                        Cancer Type: {patient.cancerType}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        patient.onboardingStep >= 9
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {patient.onboardingStep >= 9
                        ? 'Onboarded'
                        : `Step ${patient.onboardingStep}/9`}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
