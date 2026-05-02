'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCoordinatorStore } from '@/lib/store';
import Link from 'next/link';
import { FiLogOut, FiUsers, FiHome } from 'react-icons/fi';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, coordinatorName, logout } = useCoordinatorStore();

  useEffect(() => {
    if (!isAuthenticated && typeof window !== 'undefined') {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 text-white">
        <div className="p-6">
          <h1 className="text-2xl font-bold">Care Setu</h1>
          <p className="mt-2 text-indigo-200">Coordinator Dashboard</p>
        </div>

        <nav className="mt-8 space-y-2 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-indigo-800"
          >
            <FiHome className="text-xl" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/patients"
            className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-indigo-800"
          >
            <FiUsers className="text-xl" />
            Patients
          </Link>
        </nav>

        <div className="absolute bottom-0 w-64 border-t border-indigo-800 p-4">
          <div className="mb-4 text-sm text-indigo-200">
            {coordinatorName}
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg bg-indigo-800 px-4 py-2 text-sm hover:bg-indigo-700"
          >
            <FiLogOut />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
